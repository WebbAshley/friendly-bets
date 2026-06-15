const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();

exports.pushNotification = onDocumentCreated("notifications/{id}", async event => {
  const { toUserId, title, body, icon } = event.data.data();
  const user = await admin.firestore().doc(`users/${toUserId}`).get();
  const token = user.data()?.fcmToken;
  if (!token) return;
  await admin.messaging().send({
    token,
    notification: { title, body },
    webpush: { notification: { icon } },
  });
});
