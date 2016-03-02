# update-couch-designs

A utility to create / update design documents on a CouchDB database, and index their views with "zero downtime".

Typically when a design document is updated, none of its views can return results until CouchDB has re-indexed every view on the updated document. This can take hours on large databases. update-couch-designs achieves "zero downtime" by writing the updated versions to *temporary design documents*. These temporary docs are then indexed with [couchdb-indexer](https://www.npmjs.com/package/couchdb-indexer). After indexing is complete, the original design docs are updated to match the temporary design docs and then the temporary design docs are deleted. Because CouchDB is able to identify that the temporary design docs are identical to the updated docs, it does not need to re-index the updated design docs. Thus the effect is that views can always return results without any delay for indexing.

## Installation

The module is published to npm. Install it as per usual:

    npm install -g update-couch-designs

## Usage

Installing the module globally will allow you to run the `update-couch-designs`
command. It requires some options:

- `--db` - the URL of a CouchDB database
- `--docs` - a glob from which JSON/JS design documents will be found
- `--temp-doc-prefix` - the prefix used for naming temporary design docs: `_id: _design/{% TEMP-DOC-PREFIX %}original_id`

If the specified database does not exist at the given URL it will be created.
Any design document files matched by the glob will be inserted if they do not
already exist in the database or updated if they do already exist and have
changed since the last update.

Note that the design document files are expected to be valid JSON or valid
JavaScript programs. They are pulled into the script via `require` so if you're
using actual JavaScript rather than JSON for your design documents make sure the
exported object contains stringified functions.
