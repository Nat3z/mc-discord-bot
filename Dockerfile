# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:debian as base
WORKDIR /usr/src/app

# install dependencies into temp directory
# this will cache them and speed up future builds
FROM base AS install
RUN mkdir -p /temp/dev
RUN apt-get update && apt-get upgrade && apt-get install software-properties-common -y && apt-key adv --keyserver keyserver.ubuntu.com --recv-keys EA8CACC073C3DB2A && add-apt-repository ppa:linuxuprising/java && apt-get update && apt-get install -y openjdk-16-jdk
COPY package.json bun.lockb /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# install with --production (exclude devDependencies)
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY --chown=bun:bun . .

# [optional] tests & build
ENV NODE_ENV=production

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install --chown=bun:bun /temp/prod/node_modules node_modules
COPY --from=prerelease --chown=bun:bun /usr/src/app/app.ts .
COPY --from=prerelease --chown=bun:bun /usr/src/app/.env .
COPY --from=prerelease --chown=bun:bun /usr/src/app/start.sh .
COPY --from=prerelease --chown=bun:bun /usr/src/app/package.json .

# run the app
RUN chown bun /usr/src/app/
USER bun
EXPOSE 25565/tcp
ENTRYPOINT [ "bun", "run", "app.ts" ]
