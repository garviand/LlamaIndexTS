#!/bin/bash

PACKAGE_PATH="packages/llamaindex"
PACKAGE_JSON="$PACKAGE_PATH/package.json"
TEMP_PACKAGE_JSON="$PACKAGE_PATH/package.temp.json"
BACKUP_PACKAGE_JSON="$PACKAGE_PATH/package.backup.json"

# Get the version of @llamaindex/env from its package.json
ENV_PACKAGE_PATH="packages/env"
ENV_PACKAGE_JSON="$ENV_PACKAGE_PATH/package.json"
ENV_VERSION=$(jq -r '.version' $ENV_PACKAGE_JSON)

# Backup the original package.json
cp $PACKAGE_JSON $BACKUP_PACKAGE_JSON

# Replace workspace:* with the actual versions and rename the package
jq --arg env_version "$ENV_VERSION" '.dependencies["@llamaindex/env"] = $env_version | .name = "@garviand/llamaindex"' $PACKAGE_JSON > $TEMP_PACKAGE_JSON

# Replace the original package.json with the updated one
mv $TEMP_PACKAGE_JSON $PACKAGE_JSON

# Set npm registry to npmjs
npm set registry https://registry.npmjs.org/

# Clean npm cache
npm cache clean --force

# Publish the package
(cd $PACKAGE_PATH && npm publish --access public)

# Restore the original package.json
mv $BACKUP_PACKAGE_JSON $PACKAGE_JSON

# Revert npm registry to default
npm set registry https://registry.npmjs.org/