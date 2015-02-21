#!/usr/bin/env node

import optimist from 'optimist';
import equal from 'deep-equal';
import Qouch from 'qouch';
import glob from 'glob';
import fs from 'fs';

// Configure CLI options.
let argv = optimist
  .usage('Update the design documents in a CouchDB database.')
  .describe('db', 'The URL of a CouchDB database')
  .describe('docs', 'A glob matching CouchDB design documents (JSON files)')
  .demand([ 'db', 'docs' ])
  .argv;

// Remove trailing slash from the database URL if necessary.
let { db, docs } = argv;
db = db.replace(/\/$/, '');

// Get files matching the glob.
glob(docs, ( err, files ) => {

  // Read the contents of the files.
  Promise.all(files.map(( file ) => {
    return new Promise(( resolve, reject ) => {
      fs.readFile(file, { encoding: 'utf8' }, ( err, file ) => {

        if ( err ) {
          return reject(err);
        }

        return resolve(file);
      })
    });
  }))
  .then(( docs ) => {

    // The design documents should all be JSON. We attempt to parse them and
    // exit if any file is invalid.
    docs = docs.map(( doc, i ) => {
      try {
        return JSON.parse(doc);
      } catch ( err ) {
        throw new Error('Invalid JSON in design document: ' + files[ i ]);
      }
    });

    // If we've reached this point successfully we can attempt to insert the
    // design documents.
    let qouch = new Qouch(db);

    return new Promise(( resolve, reject ) => {

      // Attempt to create the database.
      qouch.createDB()
      .then(() => resolve())
      .catch(( err ) => {

        // CouchDB returns an HTTP 412 status code if the database already
        // exists. If that's the case we can continue.
        if ( err.response && err.response.status === 412 ) {
          return resolve();
        }

        return reject(err);
      });
    })
    .then(() => {

      // Get existing design documents from the database.
      return qouch.fetch(docs.map(( doc ) => doc._id));
    })
    .then(( existingDocs ) => {

      // Build a map of the existing design document IDs to documents.
      existingDocs = existingDocs.reduce(( obj, doc ) => {
        if ( doc ) {
          obj[ doc._id ] = doc;
        }
        return obj;
      }, {});

      // Find which design documents need to be inserted or updated.
      let changed = [];

      docs.forEach(( doc ) => {

        let currentDoc = existingDocs[ doc._id ];

        if ( currentDoc ) {

          // If the design document already exists in the database we need to
          // set the revision on the potentially updated document as CouchDB
          // requires a specific revision to update.
          doc._rev = current._rev;

          if ( equal(currentDoc, doc) ) {

            // The design document has not changed since it was last updated.
            console.info('NO CHANGE %s ( _rev: %s )', doc._id, doc._rev);
          } else {

            // The design document has changed and needs to be updated.
            console.info('UPDATE %s from _rev: %s', doc._id, doc._rev);
            changed.push(doc);
          }
        } else {

          // It's a new design document and will be inserted into the database.
          console.info('CREATE %s', doc._id);
          changed.push(doc);
        }
      });

      // Send the design documents to CouchDB. Those that now have a revision
      // specified will be updated and others will be created.
      return qouch.bulk(changed);
    });
  })
  .catch(( err ) => {

    // Something went wrong. Print the error and exit.
    console.error(err);
    process.exit(1);
  });
});
