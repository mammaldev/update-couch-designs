import 'core-js/shim';

import equal from 'deep-equal';
import Qouch from 'qouch';
import glob from 'glob';
import path from 'path';
import fs from 'fs';
import { format } from 'util';
import ixcouch from 'couchdb-indexer';

export default ({
  db = '',
  docs = '',
  tempDocPrefix = format('ucd-%d-', +new Date)
}) => {

  // Remove trailing slash from the database URL if necessary.
  db = db.replace(/\/$/, '');

  return new Promise(( resolve, reject ) => {

    // Get files matching the glob.
    glob(docs, ( err, files ) => {

      if ( err ) {
        return reject(err);
      }

      if ( !files.length ) {
        return reject(new Error('No files found.'));
      }

      return resolve(files);
    });
  })
  .then(( files ) => {

    // Import all the files. They should all be either valid JSON or valid JS
    // programs. Node's require can handle both. This will throw if any of the
    // design document files are invalid.
    let docs = files.map(( file ) => require(path.resolve(file)));
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

      // if no design docs have been added or changed then there's nothing more to do
      if ( !changed.length ) {
        return [];
      }

      // create temp design docs
      let tempDocs = changed.map(( orig ) => {
        var tmp = JSON.parse(JSON.stringify(orig));
        tmp._id = tmp._id.replace(/^(_design\/)/, '$1' + tempDocPrefix)
        tmp._rev = void 0;
        return tmp;
      });

      console.info('> Save temporary design docs with prefix "%s"', tempDocPrefix);

      return qouch.bulk(tempDocs)
      .then(updateRevs(tempDocs))
      .then(() => {

        // index newly created temp design docs
        console.info('> Index views on new temp design docs');
        console.log({
          filter: new RegExp('^' + tempDocPrefix),
          maxActiveTasks: 4, // TODO: provide option rather than hard-coding maxActiveTasks
        });

        return ixcouch(qouch, {
          filter: new RegExp('^' + tempDocPrefix),
          maxActiveTasks: 4, // TODO: provide option rather than hard-coding maxActiveTasks
        });

      })
      .then(() => {

        // now that views indexed, save changed docs under original names
        console.info('> Indexing complete - update original design docs');
        return qouch.bulk(changed);

      })
      .then(updateRevs(changed))
      .then(() => {

        // finally, delete the temporary design docs and return changed docs
        console.info('> Delete temporary design docs');

        tempDocs.forEach(( doc ) => doc._deleted = true);
        return qouch.bulk(tempDocs)

      })
      .then(() => {
        console.info('> Success');
        return changed;
      });
    });
  });
};

function updateRevs( originals ) {
  return function ( updates ) {

    originals.forEach(( orig, i ) => orig._rev = updates[ i ]._rev);

    return originals;
  };
}
