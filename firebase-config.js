// Configuração Firebase
const firebaseConfig = {
    apiKey: "AIzaSyB1TPclkYdBvyBBD0Hd6y7cUhm3Z15nQo8",
    authDomain: "inventario-br.firebaseapp.com",
    projectId: "inventario-br",
    storageBucket: "inventario-br.firebasestorage.app",
    messagingSenderId: "121684905712",
    appId: "1:121684905712:web:bffaf156f4aaf8597e3c35"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referências globais
const db = firebase.firestore();
const auth = firebase.auth();

// Configurar persistência offline
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.warn('⚠️ Múltiplas abas abertas. Persistência offline limitada.');
        } else if (err.code == 'unimplemented') {
            console.warn('⚠️ Navegador não suporta persistência offline.');
        }
    });

console.log('✅ Firebase inicializado');
