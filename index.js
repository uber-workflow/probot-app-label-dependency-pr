/** Copyright (c) 2018 Uber Technologies, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const deepEqual = require('fast-deep-equal');

module.exports = robot => {
  robot.on('pull_request.opened', check);
  robot.on('pull_request.edited', check);
  robot.on('pull_request.synchronize', check);
  robot.on('pull_request.unlabeled', check);
  robot.on('pull_request.labeled', check);

  async function check(context) {
    const pr = context.payload.pull_request;

    // set status to pending while checks happen
    setStatus(context, {
      state: 'pending',
      description: `Checking whether to apply or remove 'dependencies' label`,
    });

    async function getFileFromRef(filePath, ref, transform) {
      const dataBuf = (await context.github.repos.getContent(
        context.repo({
          path: filePath,
          ref: ref,
        }),
      )).data;

      return transform(
        Buffer.from(dataBuf.content, dataBuf.encoding).toString('utf8'),
      );
    }

    async function getChangedJsonFile(filePath) {
      return {
        base: await getFileFromRef(filePath, pr.base.ref, JSON.parse),
        head: await getFileFromRef(filePath, pr.head.ref, JSON.parse),
      };
    }

    async function setLabel(check, label) {
      try {
        if (check) {
          await context.github.issues.addLabels(
            context.issue({
              labels: [label],
            }),
          );
        } else {
          await context.github.issues.removeLabel(
            context.issue({
              name: 'dependencies',
            }),
          );
        }
      } catch (err) {
        if (err.code !== 404) {
          throw err;
        }
      }
    }

    async function isDevDependenciesChange(baseJson, headJson) {
      return deepEqual(baseJson.devDependencies, headJson.devDependencies);
    }

    async function isDependenciesChange(baseJson, headJson) {
      return deepEqual(baseJson.dependencies, headJson.dependencies);
    }

    const changes = await getChangedJsonFile('package.json');

    // Set labels for 'infra' and 'dependencies'
    setLabel(isDevDependenciesChange(changes.base, changes.head), 'infra');
    setLabel(isDependenciesChange(changes.base, changes.head), 'dependencies');

    // set status to success
    setStatus(context, {
      state: 'success',
      description: 'Dependencies and infra labels have been set (or unset)',
    });
  }
};

async function setStatus(context, {state, description}) {
  const {github} = context;
  return github.repos.createStatus(
    context.issue({
      state,
      description,
      sha: context.payload.pull_request.head.sha,
      context: 'probot/label-dependency-pr',
    }),
  );
}
