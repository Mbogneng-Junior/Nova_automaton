#!/usr/bin/env node
/**
 * Script pour obtenir un refresh_token YouTube OAuth 2.0
 * 
 * Usage:
 *   1. npm install googleapis
 *   2. Remplace CLIENT_ID et CLIENT_SECRET ci-dessous
 *   3. node scripts/get-youtube-token.js
 *   4. Visite l'URL affichée et autorise l'application
 *   5. Colle le code d'autorisation
 *   6. Copie le refresh_token dans ton .env
 */

const { google } = require('googleapis');
const readline = require('readline');

// ⚠️ REMPLACE CES VALEURS PAR TES CREDENTIALS GOOGLE CLOUD
const CLIENT_ID = 'TON_CLIENT_ID_ICI';
const CLIENT_SECRET = 'TON_CLIENT_SECRET_ICI';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // Pour desktop app

// Scopes nécessaires pour uploader des vidéos
const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube',
];

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Générer l'URL d'autorisation
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline', // Important pour obtenir un refresh_token
  scope: SCOPES,
  prompt: 'consent', // Force l'affichage de l'écran de consentement
});

console.log('\n🔐 Obtention du Refresh Token YouTube\n');
console.log('━'.repeat(60));
console.log('\n📋 Étapes:');
console.log('  1. Visite l\'URL ci-dessous dans ton navigateur');
console.log('  2. Connecte-toi avec le compte Google/YouTube à utiliser');
console.log('  3. Autorise l\'application');
console.log('  4. Copie le code d\'autorisation affiché');
console.log('  5. Colle-le ici\n');
console.log('━'.repeat(60));
console.log('\n🌐 URL d\'autorisation:\n');
console.log(authUrl);
console.log('\n' + '━'.repeat(60) + '\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question('📝 Colle le code d\'autorisation ici: ', async (code) => {
  try {
    console.log('\n⏳ Échange du code contre les tokens...\n');
    
    const { tokens } = await oauth2Client.getToken(code);
    
    console.log('✅ Tokens obtenus avec succès!\n');
    console.log('━'.repeat(60));
    console.log('\n🔑 REFRESH TOKEN (à copier dans ton .env):\n');
    console.log(tokens.refresh_token);
    console.log('\n━'.repeat(60));
    console.log('\n📝 Ajoute cette ligne dans ton .env:\n');
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n━'.repeat(60));
    console.log('\n💡 Info: Ce token ne expire jamais (sauf révocation manuelle)');
    console.log('   Tu peux le réutiliser indéfiniment.\n');
    
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'échange du code:\n');
    console.error(error.message);
    console.log('\n💡 Vérifie que:');
    console.log('   - Le code n\'a pas expiré (valide ~10 minutes)');
    console.log('   - CLIENT_ID et CLIENT_SECRET sont corrects');
    console.log('   - Le REDIRECT_URI correspond à celui configuré dans Google Cloud\n');
  }
  
  rl.close();
});

// Made with Bob
