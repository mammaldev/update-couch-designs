# update-couch-designs

A utility to create / update design documents on a CouchDB database, and index their views with *zero downtime*.

Typically when a design document is updated, none of its views can return results until CouchDB has re-indexed every view on the updated document. This can take hours on large databases. update-couch-designs achieves *zero downtime* by:

1. Writing the updated versions to *temporary design documents*.
1. These temporary docs are indexed with [couchdb-indexer](https://www.npmjs.com/package/couchdb-indexer).
1. The original design docs are updated to match the temporary design docs.
1. The temporary design docs are deleted.

Because CouchDB is able to identify that the temporary design docs are identical to the updated docs, it does not need to re-index the updated design docs. Thus the effect is that views can always return results without any delay for indexing.

## Installation

The module is published to npm. You can either install it globally for CLI use, or as a module to be required within a project.

    npm install -g update-couch-designs

## Usage

Installing the module globally will allow you to run the `update-couch-designs` CLI command.

    update-couch-designs --db http://localhost:5984/my-db --docs 'db/{designs1,designs2}/*.js' --tmp-doc-prefix 'build-1-'

### Options

- `--db` - *(required)* the URL of a CouchDB database
- `--docs` - *(required)* a glob from which JSON/JS design documents will be found
- `--temp-doc-prefix` - the prefix used for naming temporary design docs: `_id: _design/{% TEMP-DOC-PREFIX %}original_id`

If the specified database does not exist at the given URL it will be created.
Any design document files matched by the glob will be inserted if they do not
already exist in the database or updated if they do already exist and have
changed since the last update.

Note that the design document files are expected to be valid JSON or valid
JavaScript programs. They are pulled into the script via `require` so if you're
using actual JavaScript rather than JSON for your design documents make sure the
exported object contains stringified functions.
