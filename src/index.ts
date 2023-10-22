#!/usr/bin/env node
import * as fs from 'fs';
import yaml from 'js-yaml';
import yargs from 'yargs';
import { Configuration } from './types.js';
import { hideBin } from 'yargs/helpers';
import { migrate } from './migrate.js';

const defaultConfigPath = 'config.yaml';

/**
 * Parses a configuration file at the given path.
 *
 * @param {string} path - The path to the configuration file.
 * @returns {Configuration} The parsed configuration object.
 * @throws {Error} If the configuration file does not exist or cannot be parsed.
 */
const parseConfigFile = (path: string): Configuration => {
  if (!fs.existsSync(path)) {
    throw new Error(`Configuration file not found at specified path: ${path}`);
  }
  try {
    const rawData = fs.readFileSync(path, 'utf-8');
    return yaml.load(rawData) as Configuration;
  } catch (err) {
    throw new Error(`Error parsing configuration file: ${err}`);
  }
};

/**
 * The main script. Parses command line arguments and starts the data migration.
 */
const argv = await yargs(hideBin(process.argv))
  .usage('$0', 'Migrate data between two Redis instances', (yargs) => {
    return yargs.option('config', {
      type: 'string',
      describe: 'Path to YAML configuration file',
      demandOption: false,
      default: defaultConfigPath,
      coerce: parseConfigFile,
    });
  })
  .help().argv;

const config = argv.config as Configuration;
migrate(config).then(() => process.exit(0));
