#!/usr/bin/env node

import yargs from 'yargs';
import updateCouchDesigns from './update-couch-designs';

// Configure CLI options.
let argv = yargs
  .usage('Update the design documents in a CouchDB database.')
  .describe('db', 'The URL of a CouchDB database')
  .describe('docs', 'A glob matching CouchDB design documents (JSON files)')
  .describe('temp-doc-prefix', 'prepend temp copies of updated design docs with prefix. These docs are then indexed separately for zero downtime.')
  .demand([ 'db', 'docs' ])
  .argv;

updateCouchDesigns(argv)
.catch(( err ) => {

  // Something went wrong. Print the error and exit.
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
});
