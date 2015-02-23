import 'core-js/shim';

import equal from 'deep-equal';
import Qouch from 'qouch';
import glob from 'glob';
import path from 'path';
import fs from 'fs';

export default ( { db = '', docs = '' } ) => {

  // Remove trailing slash from the database URL if necessary.
  db = db.replace(/\/$/, '');

  // Get files matching the glob.
  glob(docs, ( err, files ) => {

    // Import all the files. They should all be either valid JSON or valid JS
    // programs. Node's require can handle both. This will throw if any of the
    // design document files are invalid.
    let cwd = process.cwd();
    let docs = files.map(( file ) => require(path.join(cwd), file));
    let qouch = new Qouch(db);

    new Promise(( resolve, reject ) => {

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
          doc._rev = currentDoc._rev;

          if ( equal(currentDoc, doc) ) {

            // The design document has not changed since it was last updated.
            console.info('NO CHANGE %s ( _rev: %s )', doc._id, doc._rev);
          } else {

            // The design document has changed and needs to be updated.
            console.info('UPDATE %s from _rev: %s', doc._id, doc._rev);
            changed.push(doc);
          }
        } else {

          // It's a new design document and will be inserted into the
          // database.
          console.info('CREATE %s', doc._id);
          changed.push(doc);
        }
      });

      // Send the design documents to CouchDB. Those that now have a revision
      // specified will be updated and others will be created.
      return qouch.bulk(changed);
    })
    .catch(( err ) => {

      // Something went wrong. Print the error and exit.
      console.error(err);
      process.exit(1);
    });
  });
};
