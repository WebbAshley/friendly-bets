importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCM_zcCiYczoUJ5A4L4p3BwWJUlPesxQ9E",
  authDomain: "friendly-bets-1a2e8.firebaseapp.com",
  projectId: "friendly-bets-1a2e8",
  storageBucket: "friendly-bets-1a2e8.firebasestorage.app",
  messagingSenderId: "23993982484",
  appId: "1:23993982484:web:abdaa03718e43e22929101",
});

const messaging = firebase.messaging();

// Background push handler — fires when the app tab is closed/backgrounded.
// Actual FCM pushes are sent by a Cloud Function watching the `notifications` collection.
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification ?? {};
  self.registration.showNotification(title ?? "Bro-Bets 👑", {
    body,
    icon: icon ?? "/logo.png",
    badge: "/logo.png",
  });
});
