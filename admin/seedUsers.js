const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
    console.log("Se adaugă utilizatorii de test în baza de date...");

    const hashedPassword = await bcrypt.hash('parola123', 10);

    const testUsers = [
        {
            email: 'ion.popescu@eucheck.ro',
            password_hash: hashedPassword,
            full_name: 'Ion Popescu',
            is_company: false,
            country: 'Romania',
            tier: 'STARTER',
            tokens_balance: 1,
            can_export_pdf: false,
            has_unlimited_scans: false,
            has_lab_discounts: false,
            is_admin: false,
            is_active: true
        },
        {
            email: 'maria.ionescu@eucheck.ro',
            password_hash: hashedPassword,
            full_name: 'Maria Ionescu',
            is_company: true,
            company_name: 'EcoPack Solutions SRL',
            vat_number: 'RO12345678',
            billing_address: 'Bd. Independentei 45, Cluj-Napoca',
            country: 'Romania',
            tier: 'PRO',
            tokens_balance: 15,
            can_export_pdf: true,
            has_unlimited_scans: false,
            has_lab_discounts: true,
            is_admin: false,
            is_active: true
        },
        {
            email: 'audit.expert@eucheck.ro',
            password_hash: hashedPassword,
            full_name: 'Alexandru Vasile',
            is_company: true,
            company_name: 'Global Compliance Tech SRL',
            vat_number: 'RO98765432',
            billing_address: 'Splaiul Unirii 100, Bucuresti',
            country: 'Romania',
            tier: 'ENTERPRISE',
            tokens_balance: 999,
            can_export_pdf: true,
            has_unlimited_scans: true,
            has_lab_discounts: true,
            is_admin: false,
            is_active: true
        },
        {
            email: 'inactive.user@eucheck.ro',
            password_hash: hashedPassword,
            full_name: 'Andrei Georgescu',
            is_company: false,
            country: 'Romania',
            tier: 'STARTER',
            tokens_balance: 0,
            can_export_pdf: false,
            has_unlimited_scans: false,
            has_lab_discounts: false,
            is_admin: false,
            is_active: false
        }
    ];

    for (const userData of testUsers) {
        await prisma.accounts.upsert({
            where: { email: userData.email },
            update: {},
            create: userData
        });
    }

    console.log("Utilizatorii de test au fost adăugați cu succes!");
}

main()
    .catch((e) => {
        console.error("Eroare la adăugarea utilizatorilor:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });