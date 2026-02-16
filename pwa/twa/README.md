# Termux PWA - TWA Wrapper for Google Play

This directory contains an Android TWA (Trusted Web Activity) project that wraps the Termux Web PWA for distribution on Google Play Store. The same APK/AAB works on both Android phones and Chromebooks.

## Prerequisites

- Java JDK 17+
- Android SDK (API 34)
- Android Studio (recommended) or command-line build tools

## Configuration

### 1. Update the PWA URL

Edit `app/build.gradle` and update the `manifestPlaceholders`:

```groovy
hostName      : "your-domain.com",
defaultUrl    : "https://your-domain.com",
```

### 2. Generate a signing key

```bash
keytool -genkey -v -keystore termux-pwa.keystore -alias termux -keyalg RSA -keysize 2048 -validity 10000
```

### 3. Get the SHA-256 fingerprint

```bash
keytool -list -v -keystore termux-pwa.keystore -alias termux | grep SHA256
```

### 4. Update Digital Asset Links

Replace the fingerprint in `../public/.well-known/assetlinks.json` with your signing key's SHA-256 fingerprint.

### 5. Build

```bash
./gradlew :app:bundleRelease   # AAB for Play Store
./gradlew :app:assembleDebug   # APK for testing
```

## How It Works

The TWA launches Chrome in full-screen mode without browser UI, rendering the PWA as a native app. Digital Asset Links verification proves ownership of both the app and the website. This same APK works on Chromebooks via Google Play Store.
