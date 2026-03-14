# 📸 Polaroid Wall

A beautiful, interactive, and cloud-synced photo album inspired by classic Polaroid photography. Built with a modern space-themed UI and powered by Supabase and Clerk.

## 🚀 Features

- **Supabase Integration**: Your memories are securely stored in the cloud.
- **Clerk Authentication**: Secure user accounts and profiles.
- **Interactive UI**: Space-themed background with floating UFOs and twinkling stars.
- **Album Management**: Organize your photos into custom albums.
- **Trash Bin**: Soft-delete system to prevent accidental loss of memories.
- **Print Mode**: Batch selection for printing your Polaroids.
- **Theme Customization**: Change frame and font colors globally.
- **Notifications**: Real-time alerts for uploads, downloads, and system actions.

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **Auth**: Clerk
- **Libraries**: `html2pdf.bundle.min.js` (for printing)

## 📦 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/khaanzahid/album.git
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables in a `.env` file:
   ```env
   PORT=3000
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   CLERK_SECRET_KEY=your_clerk_secret_key
   ```

4. Create the required tables in your Supabase SQL Editor using the provided schema.

5. Start the server:
   ```bash
   node server.js
   ```

## 🤝 Socials

- **Instagram**: [@chief_zaahid](https://instagram.com/chief_zaahid)
- **LinkedIn**: [Zahid Khan](https://www.linkedin.com/in/zahid-khan-51383b29a/)
- **GitHub**: [@khaanzahid](https://github.com/khaanzahid)

---
Made with ❤️ by Zahid Khan
