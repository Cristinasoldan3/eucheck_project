const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CATEGORIES_SEED = [
    // CATEGORIA 1: Produse, Marcaj CE & Siguranță
    {
        code: '2009/48/EC',
        title: 'Siguranța jucăriilor și avertismente obligatorii',
        category: 1,
        description: 'Cerințe privind marcajul CE, avertismentele de vârstă și prevenirea riscurilor fizice/mecanice.',
        official_url: 'https://eur-lex.europa.eu/legal-content/RO/TXT/?uri=CELEX:32009L0048',
        version: 1,
        is_active: true,
        rules: [
            {
                clause_reference: 'Art. 11(2)',
                title: 'Avertismente de vârstă și riscuri specifice',
                keywords: ['0-3', '36 luni', 'months', 'avertisment', 'warning', 'sufocare', 'choking', 'piese mici'],
                weight: 5,
                is_mandatory: true,
                recommendation: 'Adaugă avertismentele clare privind limita de vârstă și riscurile specifice (ex. piese mici / sufocare).'
            },
            {
                clause_reference: 'Art. 16',
                title: 'Marcaj CE și conformitate',
                keywords: ['ce', '2009/48/ec', 'conformitate', 'conformity', 'declaratie'],
                weight: 4,
                is_mandatory: true,
                recommendation: 'Asigură prezența marcajului CE vizibil și lizibil și a referinței la directiva aplicabilă.'
            }
        ]
    },
    {
        code: '2014/30/EU',
        title: 'Compatibilitate electromagnetică (EMC)',
        category: 1,
        description: 'Cerințe privind limitarea perturbațiilor electromagnetice și imunitatea echipamentelor.',
        official_url: 'https://eur-lex.europa.eu/legal-content/RO/TXT/?uri=CELEX:32014L0030',
        version: 1,
        is_active: true,
        rules: [
            {
                clause_reference: 'Art. 6 / Anexa I',
                title: 'Cerințe esențiale EMC',
                keywords: ['emc', '2014/30/eu', 'compatibilitate electromagnetica', 'electromagnetic', 'imunitate', 'emisie'],
                weight: 4,
                is_mandatory: true,
                recommendation: 'Include în documentația tehnică evaluarea EMC și conformitatea cu cerințele din Anexa I.'
            }
        ]
    },

    // CATEGORIA 2: Protecția Datelor & Documente Interne
    {
        code: 'GDPR 2016/679',
        title: 'Regulamentul general privind protecția datelor (GDPR)',
        category: 2,
        description: 'Cerințe de informare, temei legal, drepturi ale persoanelor vizate și securitate a datelor.',
        official_url: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj',
        version: 1,
        is_active: true,
        rules: [
            {
                clause_reference: 'Art. 13',
                title: 'Informarea operatorului, scopului și temeiului legal',
                keywords: ['operator', 'temei legal', 'consintamant', 'consent', 'interes legitim', 'scop', 'date cu caracter personal'],
                weight: 5,
                is_mandatory: true,
                recommendation: 'Menționează identitatea operatorului, scopurile prelucrării, temeiul legal și perioada de retenție.'
            },
            {
                clause_reference: 'Art. 15-22',
                title: 'Drepturile persoanelor vizate și contact / DPO',
                keywords: ['acces', 'rectificare', 'stergere', 'portabilitate', 'opozitie', 'dpo', 'drepturi'],
                weight: 4,
                is_mandatory: true,
                recommendation: 'Precizează drepturile persoanelor vizate și modalitatea de contact pentru exercitarea lor.'
            }
        ]
    },

    // CATEGORIA 3: Substanțe Chimice, Mediu & Ambalaje
    {
        code: '2011/65/EU',
        title: 'Restricții privind substanțele periculoase (RoHS)',
        category: 3,
        description: 'Limitarea substanțelor periculoase în echipamente electrice și electronice.',
        official_url: 'https://eur-lex.europa.eu/legal-content/RO/TXT/?uri=CELEX:32011L0065',
        version: 1,
        is_active: true,
        rules: [
            {
                clause_reference: 'Art. 7 / Anexa II',
                title: 'Conformitate RoHS și substanțe restricționate',
                keywords: ['rohs', '2011/65/eu', 'plumb', 'lead', 'mercur', 'mercury', 'cadmiu', 'cadmium', 'ftalati', 'dehp'],
                weight: 5,
                is_mandatory: true,
                recommendation: 'Verifică încadrarea în limitele RoHS și prezența declarației de conformitate.'
            }
        ]
    },
    {
        code: 'PACKAGING-EU',
        title: 'Etichetare ambalaje și gestionarea deșeurilor de ambalaje',
        category: 3,
        description: 'Cerințe de identificare a materialelor de ambalaj și informare privind colectarea/reciclarea.',
        official_url: 'https://eur-lex.europa.eu/homepage.html',
        version: 1,
        is_active: true,
        rules: [
            {
                clause_reference: 'Etichetare Materiale',
                title: 'Codificare material ambalaj și instrucțiuni de sortare',
                keywords: ['ambalaj', 'packaging', 'pap', 'pet', 'hdpe', 'reciclare', 'recycling', 'deseuri', 'sortare'],
                weight: 4,
                is_mandatory: true,
                recommendation: 'Adaugă identificarea tipului de material al ambalajului și indicații clare de reciclare/sortare.'
            }
        ]
    }
];

async function main() {
    for (const entry of CATEGORIES_SEED) {
        const { rules, ...standardData } = entry;

        const standard = await prisma.standards.upsert({
            where: { code: standardData.code },
            update: standardData,
            create: standardData
        });

        for (const rule of rules) {
            const existing = await prisma.compliance_rules.findFirst({
                where: {
                    standard_id: standard.id,
                    clause_reference: rule.clause_reference,
                    title: rule.title
                }
            });

            if (existing) {
                await prisma.compliance_rules.update({
                    where: { id: existing.id },
                    data: {
                        keywords: rule.keywords,
                        weight: rule.weight,
                        is_mandatory: rule.is_mandatory,
                        recommendation: rule.recommendation,
                        is_active: true
                    }
                });
            } else {
                await prisma.compliance_rules.create({
                    data: {
                        standard_id: standard.id,
                        ...rule,
                        is_active: true
                    }
                });
            }
        }
    }

    console.log('Toate categoriile, directivele și regulile de conformitate au fost încărcate.');
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });