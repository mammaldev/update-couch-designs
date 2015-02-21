# update-couch-designs

A command to insert design documents into a CouchDB database.

## Installation

The module is published to npm. Install it as per usual:

    npm install -g update-couch-designs

## Usage

Installing the module globally will allow you to run the `update-couch-designs`
command. It requires some options:

 - `--db` - the URL of a CouchDB database
 - `--docs` - a glob from which JSON design documents will be found

If the specified database does not exist at the given URL it will be created.
Any design document files matched by the glob will be inserted if they do not
already exist in the database or updated if they do already exist and have
changed since the last update.

Note that the design document files are expected to be valid JSON. If you
prefer to write design documents as actual JavaScript programs you'll need to
either convert them or add some conversion mechanism to your build process.
