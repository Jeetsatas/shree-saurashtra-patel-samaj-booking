# Shree Saurashtra Leuva Patel Samaj Booking System

An internal booking management application for managing facility bookings, availability, rates, and administrative access for Shree Saurashtra Leuva Patel Samaj, Nikol–Naroda, Ahmedabad.

## Project overview

The application is built with Next.js, TypeScript, Prisma, and PostgreSQL. The repository also includes SQLite-oriented schema and database preparation scripts for local development. Review the deployment configuration and database provider before using it in a production environment.

## Features

- Admin sign-in and role-based access
- Facility and availability management
- Booking, enquiry, and discount workflows
- Administrative user and settings screens
- Booking export and activity routes

## Requirements

- Node.js compatible with the versions supported by the project dependencies
- npm
- A PostgreSQL database for the default Prisma schema

## Local setup

1. Clone this repository and install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and set the required values for your local database and authentication configuration. Use unique, private values; never commit `.env`.

3. Prepare and update the database schema using the project scripts appropriate to your chosen database provider. Review the Prisma schemas and scripts before running them against production data.

4. Start the development server:

   ```sh
   npm run dev
   ```

5. Open `http://localhost:3000`.

## Initial administrator setup

Do not use credentials from documentation, source control, or sample data. Provision the first administrator through a trusted, private process, set a unique password, and verify that the account is stored using the application's password hashing flow. The production build does not seed administrator accounts. Run the seed script only as a deliberate, private one-time setup step, then remove bootstrap password values from the deployment environment. The seed script updates account hashes when run, so do not run it as part of routine deployments.

## Environment configuration

The application uses a database connection and an authentication signing secret. Refer to `.env.example` and the application configuration for the exact variable names. Supply values through your local environment or deployment platform's secret manager. Do not paste real credentials into README files, issue trackers, screenshots, or committed `.env` files.

## Security notes

- Treat any credentials previously published in this repository as compromised and rotate them immediately, including reused passwords.
- Review administrator accounts, revoke active sessions where possible, and check relevant access logs.
- Enforce authorization on server-side API routes; a hidden or disabled UI control is not an access control.
- Review seed scripts, deployment settings, database access, and backup handling before production use.
- Removing a secret from the latest README does not erase it from earlier Git commits or forks.

## Deployment

The repository includes Vercel and container-related configuration. Review the build and database scripts before deployment, especially the schema push operation. Bootstrap administrator creation is a separate one-time step. Configure production environment variables in the hosting provider and use a managed database backup and migration plan.

## Repository structure

- `src/app/` — Next.js pages and API routes
- `src/lib/` — authentication and database helpers
- `prisma/` — database schemas and seed script
- `scripts/` — database preparation and maintenance utilities

## License

No license is currently documented. Contact the repository owner before reusing this project.
