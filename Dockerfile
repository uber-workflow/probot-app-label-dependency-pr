FROM node:8.11.3@sha256:04986974434fc565529feaac1d62cce4f9fe99ba4906f076ce498000120a45d4

WORKDIR /probot-app-label-dependency-pr

COPY package.json /probot-app-label-dependency-pr/

RUN yarn
