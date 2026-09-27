#!/usr/bin/env node

/**
 * SQL Parsing Diagnostic Tool
 *
 * Tests the SQL import parsing logic to identify field extraction issues
 * This helps debug why certain restaurants (like "Restorant Aroma") might not be imported correctly
 */

// Sample NameCheap database structure (from phpMyAdmin export)
// Users table: id, name, email, ?, password, ?, ?, ?, business_name
// Menus table: id, created_at, updated_at, owner, active, title

const sampleUserInsert = `INSERT INTO \`users\` VALUES
(1,'Admin User','admin@example.com','','password123','','','','Business Admin'),
(2,'Bedri User','nderi_99@hotmail.com','','hashedpwd456','','','','Restorant Aroma'),
(3,'Test User','test@example.com','','hashedpwd789','','','','Test Business');`;

const sampleMenuInsert = `INSERT INTO \`menus\` VALUES
(1,'2025-01-01 00:00:00','2025-01-01 00:00:00',1,1,'Menu 1'),
(40,'2025-01-02 00:00:00','2025-01-02 00:00:00',2,1,NULL),
(50,'2025-01-03 00:00:00','2025-01-03 00:00:00',2,1,'Second Menu');`;

function testUserParsing(sqlContent) {
  console.log('\n=== Testing User Parsing ===\n');

  const userLines = sqlContent.match(/INSERT INTO `users`[\s\S]+?;/gi) || [];
  const userMap = {};
  const userBusinessNames = {};

  for (const line of userLines) {
    console.log('Parsing user line...');
    const valueMatches = line.match(/VALUES\s+([\s\S]*?)(?:;|$)/i);
    if (!valueMatches) {
      console.log('❌ No VALUES found');
      continue;
    }

    const valuesStr = valueMatches[1];
    const valueGroups = valuesStr.match(/\([^)]+\)/g) || [];
    console.log(`Found ${valueGroups.length} value groups\n`);

    for (const group of valueGroups) {
      try {
        const cleanGroup = group.slice(1, -1);
        const parts = cleanGroup.match(/'[^']*'|"[^"]*"|NULL|\d+/g) || [];

        console.log(`Group: ${group}`);
        console.log(`Parts array:`, parts);
        console.log(`Parts count: ${parts.length}\n`);

        if (parts.length < 6) {
          console.log('⚠️  Skipping - not enough fields\n');
          continue;
        }

        const oldId = parseInt(parts[0] || '0');
        const name = parts[1]?.slice(1, -1) || '';
        const email = parts[2]?.slice(1, -1) || '';
        const password = parts[4]?.slice(1, -1) || '';
        const businessName = parts[8]?.slice(1, -1) || '';

        console.log(`✅ Parsed user:`);
        console.log(`   ID: ${oldId}`);
        console.log(`   Name: ${name}`);
        console.log(`   Email: ${email}`);
        console.log(`   Password: ${password}`);
        console.log(`   Business Name: ${businessName}`);
        console.log('');

        userMap[oldId] = oldId; // Simulate UUID mapping
        userBusinessNames[oldId] = businessName;
      } catch (e) {
        console.log(`❌ Error: ${e.message}\n`);
      }
    }
  }

  return { userMap, userBusinessNames };
}

function testMenuParsing(sqlContent, userBusinessNames) {
  console.log('\n=== Testing Menu/Restaurant Parsing ===\n');

  const menuLines = sqlContent.match(/INSERT INTO `menus`[\s\S]+?;/gi) || [];
  const created = [];

  for (const line of menuLines) {
    console.log('Parsing menu line...');
    const valueMatches = line.match(/VALUES\s+([\s\S]*?)(?:;|$)/i);
    if (!valueMatches) {
      console.log('❌ No VALUES found');
      continue;
    }

    const valuesStr = valueMatches[1];
    const valueGroups = valuesStr.match(/\([^)]+\)/g) || [];
    console.log(`Found ${valueGroups.length} value groups\n`);

    for (const group of valueGroups) {
      try {
        const cleanGroup = group.slice(1, -1);
        const parts = cleanGroup.match(/'[^']*'|"[^"]*"|NULL|\d+/g) || [];

        console.log(`Group: ${group}`);
        console.log(`Parts array:`, parts);
        console.log(`Parts count: ${parts.length}\n`);

        if (parts.length < 4) {
          console.log('⚠️  Skipping - not enough fields\n');
          continue;
        }

        const oldMenuId = parseInt(parts[0] || '0');
        const oldOwnerId = parseInt(parts[3] || '0');
        const active = parts[4] === '1' || parts[4] === 'true';
        const titleRaw = parts[5];
        let title = titleRaw === 'NULL' ? '' : (titleRaw?.slice(1, -1) || '');

        console.log(`✅ Extracted fields:`);
        console.log(`   Menu ID: ${oldMenuId}`);
        console.log(`   Owner ID: ${oldOwnerId}`);
        console.log(`   Active: ${active}`);
        console.log(`   Title (raw): ${parts[5]}`);
        console.log(`   Title (processed): "${title}"`);

        // Apply fallback logic
        if (!title) {
          title = userBusinessNames[oldOwnerId] || `Menu ${oldMenuId}`;
          console.log(`   Title (after fallback): "${title}"`);
        }

        const slug = title
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

        console.log(`   Generated slug: "${slug}"`);
        console.log('');

        created.push({ id: oldMenuId, title, slug, ownerId: oldOwnerId });
      } catch (e) {
        console.log(`❌ Error: ${e.message}\n`);
      }
    }
  }

  return created;
}

function main() {
  console.log('🔍 SQL Import Parsing Diagnostic Tool\n');
  console.log('======================================\n');

  // Test with sample data
  const sampleSql = sampleUserInsert + '\n\n' + sampleMenuInsert;
  console.log('Sample SQL:\n', sampleSql, '\n');

  const { userMap, userBusinessNames } = testUserParsing(sampleSql);
  const menus = testMenuParsing(sampleSql, userBusinessNames);

  console.log('\n=== Summary ===\n');
  console.log('User Business Names Map:', userBusinessNames);
  console.log('\nCreated Restaurants:');
  menus.forEach(m => {
    console.log(`  - ${m.title} (slug: ${m.slug}, owner: ${m.ownerId})`);
  });

  console.log('\n📌 Key Finding:');
  if (menus.some(m => m.slug.includes('restorant-aroma'))) {
    console.log('✅ "Restorant Aroma" would be correctly parsed');
  } else if (menus.some(m => m.title === 'Restorant Aroma')) {
    console.log('✅ "Restorant Aroma" title found (check slug generation)');
  } else {
    console.log('❌ "Restorant Aroma" NOT found in parsed results');
  }
}

main();
