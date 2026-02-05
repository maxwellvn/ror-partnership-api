import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { config } from '../config';
import {
  User,
  PartnershipCategory,
  Zone,
  Group,
  Church,
  Campaign,
  Subscription,
} from '../models';

// Zone data structure from zones.json
interface ZoneData {
  name: string;
  groups: Array<{ name: string; id: string }>;
}

interface RegionData {
  [zoneName: string]: ZoneData;
}

interface ZonesJson {
  [regionName: string]: RegionData;
}

// Helper to generate zone code from name
const generateZoneCode = (name: string): string => {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .substring(0, 8);
};

// Helper to get country/region from zone name
const getLocationFromZone = (zoneName: string, regionName: string): { country: string; region: string } => {
  const name = zoneName.toLowerCase();

  if (name.includes('sa zone') || name.includes('capetown') || name.includes('durban')) {
    return { country: 'South Africa', region: regionName };
  }
  if (name.includes('nigeria') || name.includes('lagos') || name.includes('abuja')) {
    return { country: 'Nigeria', region: regionName };
  }
  if (name.includes('ghana')) {
    return { country: 'Ghana', region: regionName };
  }
  if (name.includes('uk') || name.includes('united kingdom') || name.includes('london')) {
    return { country: 'United Kingdom', region: regionName };
  }
  if (name.includes('usa') || name.includes('america') || name.includes('texas') || name.includes('california')) {
    return { country: 'United States', region: regionName };
  }
  if (name.includes('canada')) {
    return { country: 'Canada', region: regionName };
  }
  if (name.includes('middle east') || name.includes('dubai') || name.includes('uae')) {
    return { country: 'UAE', region: regionName };
  }
  if (name.includes('india')) {
    return { country: 'India', region: regionName };
  }
  if (name.includes('australia')) {
    return { country: 'Australia', region: regionName };
  }

  // Default based on region name
  return { country: regionName, region: zoneName };
};

const seedData = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    // Clear existing data (optional - comment out in production)
    await User.deleteMany({});
    await PartnershipCategory.deleteMany({});
    await Zone.deleteMany({});
    await Group.deleteMany({});
    await Church.deleteMany({});
    await Campaign.deleteMany({});
    await Subscription.deleteMany({});
    console.log('Cleared existing data');

    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', config.bcryptRounds);
    const admin = await User.create({
      email: 'admin@rorpartnership.com',
      passwordHash: adminPassword,
      isEmailVerified: true,
      profile: {
        firstName: 'Admin',
        lastName: 'User',
        displayName: 'Admin User',
      },
      preferences: {
        currency: 'NGN',
        language: 'en',
        notificationsEnabled: true,
        emailUpdates: true,
      },
      status: 'active',
      role: 'super_admin',
    });
    console.log('Created admin user:', admin.email);

    // Create test partner
    const partnerPassword = await bcrypt.hash('partner123', config.bcryptRounds);
    const partner = await User.create({
      email: 'partner@test.com',
      phone: '+2348012345678',
      passwordHash: partnerPassword,
      isEmailVerified: true,
      profile: {
        firstName: 'John',
        lastName: 'Partner',
        displayName: 'John Partner',
      },
      preferences: {
        currency: 'NGN',
        language: 'en',
        notificationsEnabled: true,
        emailUpdates: true,
      },
      status: 'active',
      role: 'partner',
    });
    console.log('Created partner user:', partner.email);

    // Read zones.json file using Bun
    const zonesJsonPath = new URL('../../../../zones.json', import.meta.url).pathname;
    console.log('Reading zones from:', zonesJsonPath);

    let zonesData: ZonesJson;
    try {
      const file = Bun.file(zonesJsonPath);
      zonesData = await file.json();
    } catch (error) {
      console.error('Error reading zones.json:', error);
      throw new Error('Failed to read zones.json file');
    }

    // Track created zones and groups
    const createdZones: Map<string, mongoose.Types.ObjectId> = new Map();
    const createdGroups: Map<string, mongoose.Types.ObjectId> = new Map();
    let totalZones = 0;
    let totalGroups = 0;

    // Process each region and its zones
    for (const [regionName, regionData] of Object.entries(zonesData)) {
      console.log(`\nProcessing region: ${regionName}`);

      for (const [zoneName, zoneData] of Object.entries(regionData)) {
        // Generate unique code for zone
        let zoneCode = generateZoneCode(zoneData.name);
        let codeCounter = 1;
        while (createdZones.has(zoneCode)) {
          zoneCode = `${generateZoneCode(zoneData.name)}${codeCounter}`;
          codeCounter++;
        }

        const location = getLocationFromZone(zoneName, regionName);

        // Create zone
        const zone = await Zone.create({
          name: zoneData.name,
          code: zoneCode,
          description: `${zoneData.name} - ${regionName}`,
          location: {
            country: location.country,
            region: location.region,
            timezone: 'Africa/Lagos', // Default timezone
          },
          stats: {
            groupCount: zoneData.groups.length,
            churchCount: 0,
            partnerCount: 0,
            totalContributions: 0,
          },
          status: 'active',
        });

        createdZones.set(zoneCode, zone._id);
        totalZones++;

        // Create groups for this zone
        for (const groupData of zoneData.groups) {
          // Use the id from JSON as code, or generate one
          let groupCode = groupData.id.toUpperCase().replace(/[^A-Z0-9_]/g, '').substring(0, 20);
          let groupCodeCounter = 1;
          while (createdGroups.has(groupCode)) {
            groupCode = `${groupData.id.substring(0, 17)}${groupCodeCounter}`;
            groupCodeCounter++;
          }

          const group = await Group.create({
            name: groupData.name,
            code: groupCode,
            zoneId: zone._id,
            leadership: [],
            stats: {
              churchCount: 0,
              partnerCount: 0,
              totalContributions: 0,
            },
            status: 'active',
          });

          createdGroups.set(groupCode, group._id);
          totalGroups++;
        }

        console.log(`  Created zone "${zoneData.name}" with ${zoneData.groups.length} groups`);
      }
    }

    console.log(`\n✅ Created ${totalZones} zones and ${totalGroups} groups from zones.json`);

    // Create mock churches (one per group, for the first 20 groups as sample)
    const groupIds = Array.from(createdGroups.entries()).slice(0, 20);
    let churchCount = 0;

    for (const [groupCode, groupId] of groupIds) {
      const group = await Group.findById(groupId).populate('zoneId');
      if (!group) continue;

      const churchCode = `CE${groupCode.substring(0, 6)}`;

      try {
        await Church.create({
          name: `Christ Embassy ${group.name.replace(' GROUP', '')}`,
          code: churchCode,
          groupId: group._id,
          zoneId: group.zoneId,
          type: 'satellite',
          address: {
            city: group.name.replace(' GROUP', ''),
            country: 'South Africa',
          },
          leadership: [],
          stats: {
            memberCount: Math.floor(Math.random() * 500) + 50,
            partnerCount: Math.floor(Math.random() * 100) + 10,
            totalContributions: 0,
          },
          status: 'active',
        });

        // Update group stats
        await Group.findByIdAndUpdate(group._id, { $inc: { 'stats.churchCount': 1 } });
        await Zone.findByIdAndUpdate(group.zoneId, { $inc: { 'stats.churchCount': 1 } });

        churchCount++;
      } catch (err) {
        // Skip duplicate codes
        console.log(`  Skipped church for ${group.name} (duplicate code)`);
      }
    }

    console.log(`Created ${churchCount} sample churches`);

    // Create partnership categories
    const categories = await PartnershipCategory.insertMany([
      {
        slug: 'rhapsody-distribution',
        code: 'RD',
        name: 'Rhapsody Distribution',
        description: 'Support the printing and distribution of Rhapsody of Realities devotionals across the world.',
        shortDescription: 'Print & distribute devotionals globally',
        type: 'core',
        assets: { color: '#4F46E5' },
        config: {
          minimumAmount: 100,
          suggestedAmounts: [1000, 5000, 10000, 50000, 100000],
          currency: 'NGN',
          allowRecurring: true,
          isActive: true,
        },
        display: { order: 1, showOnHome: true, showInList: true },
      },
      {
        slug: 'translation-projects',
        code: 'TP',
        name: 'Translation Projects',
        description: 'Help translate Rhapsody of Realities into more languages to reach more people.',
        shortDescription: 'Translate to more languages',
        type: 'core',
        assets: { color: '#059669' },
        config: {
          minimumAmount: 100,
          suggestedAmounts: [1000, 5000, 10000, 25000, 50000],
          currency: 'NGN',
          allowRecurring: true,
          isActive: true,
        },
        display: { order: 2, showOnHome: true, showInList: true },
      },
      {
        slug: 'reachout-world',
        code: 'ROW',
        name: 'ReachOut World',
        description: 'Support global outreach campaigns and soul-winning initiatives.',
        shortDescription: 'Global outreach campaigns',
        type: 'core',
        assets: { color: '#DC2626' },
        config: {
          minimumAmount: 500,
          suggestedAmounts: [2000, 5000, 10000, 50000, 100000],
          currency: 'NGN',
          allowRecurring: true,
          isActive: true,
        },
        display: { order: 3, showOnHome: true, showInList: true },
      },
      {
        slug: 'bible-for-every-home',
        code: 'BEH',
        name: 'A Bible for Every Home',
        description: 'Help provide Bibles to homes that need them around the world.',
        shortDescription: 'Provide Bibles to every home',
        type: 'campaign',
        assets: { color: '#7C3AED' },
        config: {
          minimumAmount: 1000,
          suggestedAmounts: [5000, 10000, 25000, 50000, 100000],
          currency: 'NGN',
          allowRecurring: true,
          isActive: true,
          targetAmount: 100000000,
        },
        display: { order: 4, showOnHome: true, showInList: true, badge: 'CAMPAIGN' },
      },
      {
        slug: 'digital-outreach',
        code: 'DO',
        name: 'Digital Outreach',
        description: 'Support digital evangelism through apps, websites, and social media campaigns.',
        shortDescription: 'Digital evangelism initiatives',
        type: 'initiative',
        assets: { color: '#0891B2' },
        config: {
          minimumAmount: 100,
          suggestedAmounts: [1000, 2500, 5000, 10000, 25000],
          currency: 'NGN',
          allowRecurring: true,
          isActive: true,
        },
        display: { order: 5, showOnHome: false, showInList: true },
      },
      {
        slug: 'children-ministry',
        code: 'CM',
        name: "Children's Ministry",
        description: 'Support Rhapsody of Realities for children and youth programs.',
        shortDescription: 'Children & youth programs',
        type: 'core',
        assets: { color: '#F59E0B' },
        config: {
          minimumAmount: 100,
          suggestedAmounts: [500, 1000, 2500, 5000, 10000],
          currency: 'NGN',
          allowRecurring: true,
          isActive: true,
        },
        display: { order: 6, showOnHome: false, showInList: true },
      },
    ]);

    console.log(`Created ${categories.length} partnership categories`);

    // Create a sample campaign
    const campaign = await Campaign.create({
      name: 'End of Year Outreach 2024',
      code: 'EOY2024',
      description: 'Join us in reaching 1 million souls by the end of 2024 through massive Rhapsody distribution.',
      categoryId: categories[0]._id,
      scope: 'global',
      target: {
        amount: 50000000,
        currency: 'NGN',
        partnerCount: 1000,
      },
      progress: {
        currentAmount: 12500000,
        partnerCount: 287,
        transactionCount: 450,
        percentComplete: 25,
      },
      timeline: {
        startDate: new Date('2024-10-01'),
        endDate: new Date('2024-12-31'),
        isExtended: false,
      },
      settings: {
        allowRecurring: true,
        minimumAmount: 1000,
        suggestedAmounts: [5000, 10000, 25000, 50000, 100000],
        showProgress: true,
        showDonorNames: false,
        sendUpdates: true,
      },
      milestones: [
        { amount: 10000000, title: '20% Milestone', description: 'First milestone reached!' },
        { amount: 25000000, title: '50% Milestone', description: 'Halfway there!' },
        { amount: 40000000, title: '80% Milestone', description: 'Almost there!' },
        { amount: 50000000, title: 'Goal Reached!', description: 'Target achieved!' },
      ],
      status: 'active',
      createdBy: admin._id,
    });

    campaign.milestones[0].reachedAt = new Date();
    await campaign.save();

    console.log('Created sample campaign');

    console.log('\n✅ Seed completed successfully!\n');
    console.log('Test accounts:');
    console.log('  Super Admin: admin@rorpartnership.com / admin123');
    console.log('  Partner: partner@test.com / partner123');
    console.log('\nData summary:');
    console.log(`  Zones: ${totalZones}`);
    console.log(`  Groups: ${totalGroups}`);
    console.log(`  Churches: ${churchCount} (mock data)`);
    console.log(`  Categories: ${categories.length}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
