const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    // Generăm hash-ul pentru parola "admin123"
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Verificăm dacă administratorul există deja
    const existing = await prisma.accounts.findUnique({
        where: { email: 'admin.eucheck@gmail.com' }
    });

    if (!existing) {
        await prisma.accounts.create({
            data: {
                email: 'admin.eucheck@gmail.com',
                password_hash: hashedPassword,
                full_name: 'Super Admin',
                is_admin: true,
                is_active: true,
                tier: 'ENTERPRISE'
            }
        });
        console.log("Succes! Contul de Admin a fost creat cu parola: admin123");
    } else {
        // Dacă există deja, îi actualizăm parola ca să fim siguri
        await prisma.accounts.update({
            where: { email: 'admin.eucheck@gmail.com' },
            data: { password_hash: hashedPassword, is_admin: true }
        });
        console.log("Contul de Admin exista deja. Parola a fost actualizata cu succes la: admin123");
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());