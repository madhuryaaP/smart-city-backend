const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

const serviceAccount = require('./serviceAccountKey.json');

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
      });

const messaging = getMessaging(firebaseApp);

console.log('Firebase Messaging ready');

module.exports = {
  firebaseApp,
  messaging,
};