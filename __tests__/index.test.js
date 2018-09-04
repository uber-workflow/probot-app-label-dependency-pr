/** Copyright (c) 2018 Uber Technologies, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/* eslint-env jest */

const {Application} = require('probot');

const app = require('../index.js');

const prOpenedNoLabelsPayload = require('./fixtures/pr-opened-no-labels-payload.json');

describe('probot-app-label-dependency-pr', () => {
  let robot;
  let github;

  const makeGitHub = useSameContent => {
    const baseContents = JSON.stringify(
      require('./fixtures/simple-fixture/base/package.json'),
    );
    const headContents = JSON.stringify(
      require('./fixtures/simple-fixture/head/package.json'),
    );

    const makeContentResponse = content => {
      return {
        data: {
          content: content,
          encoding: 'utf8',
        },
      };
    };

    return {
      issues: {
        addLabels: jest.fn(),
        removeLabel: jest.fn(),
      },
      repos: {
        getContent: jest.fn(({ref}) => {
          if (ref === 'head') return makeContentResponse(headContents);
          else if (ref === 'base')
            return makeContentResponse(
              useSameContent ? headContents : baseContents,
            );
          throw new Error('Should never reach this branch');
        }),
        createStatus: jest.fn().mockReturnValue(Promise.resolve(true)),
      },
    };
  };

  beforeEach(() => {
    robot = new Application();
    robot.load(app);

    // Passes the mocked out GitHub API into out robot instance
    github = makeGitHub(false);
    robot.auth = () => Promise.resolve(github);
  });

  it('ensure status is set to pending and then success', async () => {
    await robot.receive({
      event: 'pull_request',
      payload: prOpenedNoLabelsPayload,
    });

    // Should immediately set pending and then success
    const statusCalls = github.repos.createStatus.mock.calls;
    expect(github.repos.createStatus).toHaveBeenCalled();
    expect(statusCalls.length).toBe(2);
    expect(statusCalls[0][0].state).toBe('pending');
    expect(statusCalls[1][0].state).toBe('success');
  });

  it('ensure both dependencies and infra labels are set', async () => {
    await robot.receive({
      event: 'pull_request',
      payload: prOpenedNoLabelsPayload,
    });

    const addLabelCalls = github.issues.addLabels.mock.calls;
    expect(github.issues.addLabels).toHaveBeenCalled();
    expect(addLabelCalls.length).toBe(2);

    const expectedAddedLabels = ['dependencies', 'infra'];
    expect(addLabelCalls.map(c => c[0].labels[0])).toEqual(
      expect.arrayContaining(expectedAddedLabels),
    );
  });

  it('ensure both dependencies and infra labels are unset', async () => {
    // Override robot.auth to return same package.json in head and base
    github = makeGitHub(true);
    robot.auth = () => Promise.resolve(github);

    await robot.receive({
      event: 'pull_request',
      payload: prOpenedNoLabelsPayload,
    });

    const removeLabelCalls = github.issues.removeLabel.mock.calls;
    expect(github.issues.removeLabel).toHaveBeenCalled();
    expect(removeLabelCalls.length).toBe(2);

    const expectedRemovedLabels = ['dependencies', 'infra'];
    expect(removeLabelCalls.map(c => c[0].name)).toEqual(
      expect.arrayContaining(expectedRemovedLabels),
    );
  });
});
