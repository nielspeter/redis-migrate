#!/usr/bin/env node
import * as fs from 'fs';
import yaml from 'js-yaml';
import { Configuration } from './types.js';
import { migrate } from './migrate.js';
import { Command } from 'commander';

/**
 * Parses a configuration file at the given path.
 *
 * @param {string} path - The path to the configuration file.
 * @returns {Configuration} The parsed configuration object.
 * @throws {Error} If the configuration file does not exist or cannot be parsed.
 */
export const parseConfigFile = (path: string): Configuration => {
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
const program = new Command();

program.option('-c, --config <path>', 'Path to YAML configuration file', 'config.yaml').parse(process.argv);

const options = program.opts();
const config = parseConfigFile(options.config);

migrate(config).then(() => process.exit(0));
