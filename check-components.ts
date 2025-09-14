#!/usr/bin/env node

/**
 * Script to check components in the database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkComponents() {
  try {
    console.log('🔍 Checking components in database...\n');

    // Get total count
    const { count, error: countError } = await supabase
      .from('components')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Error getting component count:', countError);
      return;
    }

    console.log(`📊 Total components in database: ${count}\n`);

    if (count === 0) {
      console.log('⚠️ No components found in database');
      return;
    }

    // Get all components with basic info
    const { data: components, error } = await supabase
      .from('components')
      .select('id, name, type, category, is_verified, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('❌ Error fetching components:', error);
      return;
    }

    console.log('📋 Recent components:');
    console.log('─'.repeat(80));

    components?.forEach((component, index) => {
      const verified = component.is_verified ? '✅' : '❌';
      const created = new Date(component.created_at).toLocaleDateString();
      console.log(`${index + 1}. ${component.name}`);
      console.log(`   Type: ${component.type} | Category: ${component.category} | Verified: ${verified}`);
      console.log(`   Created: ${created} | ID: ${component.id}`);
      console.log('');
    });

    // Get category breakdown
    const { data: categories, error: catError } = await supabase
      .from('components')
      .select('category')
      .order('category');

    if (!catError && categories) {
      const categoryCount = categories.reduce((acc, item) => {
        acc[item.category] = (acc[item.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      console.log('\n📂 Components by category:');
      console.log('─'.repeat(40));
      Object.entries(categoryCount)
        .sort(([,a], [,b]) => b - a)
        .forEach(([category, count]) => {
          console.log(`${category}: ${count}`);
        });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the check
checkComponents();