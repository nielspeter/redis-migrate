# Redis Data Migration Tool

This project is a tool written in TypeScript to migrate data between two Redis instances.

## Purpose

The purpose of this tool is to facilitate the migration of data from one Redis instance to another. This can be useful in scenarios such as scaling up your infrastructure, moving to a new environment, or recovering from an outage.

## Features

- Supports migration of the following Redis data types: string, hash, list, set, sorted sets (zsets), JSON, and bitmap.
- Preserves TTL (Time To Live) for all data types.

## How to Use

1. Clone the repository to your local machine.
2. Install the dependencies using `npm install`.
3. Configure the source and target Redis instances in the configuration file.
4. Run the script using `npm run start`.

You can specify the path to the configuration file with the `--config` option. By default, it looks for a file named `config.yaml` in the current directory.

```bash
npx redis-migrate --config path/to/config.yaml
```

Here's an example of what the configuration file might look like:
```yaml
chunkSize: 25000
matchPattern: "my:*"
sourceRedis:
  host: "127.0.0.1"
  port: 7379
  password: "****"
targetRedis:
  host: "127.0.0.1"
  port: 6379
  password: "****"
```

Please note that both Redis instances should be running and accessible from the machine where this tool is run.

## Requirements

- Node.js
- Access to the source and target Redis instances

## Disclaimer

Please use this tool at your own risk. Always make a backup of your data before performing any kind of migration.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
