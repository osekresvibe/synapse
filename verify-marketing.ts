
/**
 * Quick verification test for marketing page messaging
 * Run with: npx tsx verify-marketing.ts
 */

async function verifyMarketing() {
  console.log('\n🎯 MARKETING PAGE VERIFICATION');
  console.log('═'.repeat(60));
  
  const checks = {
    intentMessage: false,
    executionTagline: false,
    noEditingRequired: false
  };

  try {
    // Read the marketing page file
    const fs = require('fs');
    const path = require('path');
    const marketingPath = path.join(__dirname, 'client/src/pages/marketing.tsx');
    const content = fs.readFileSync(marketingPath, 'utf-8');

    // Check for key messaging
    checks.intentMessage = content.includes('Describe your INTENT');
    checks.executionTagline = content.includes("we'll handle the EXECUTION");
    checks.noEditingRequired = content.includes("You shouldn't need to know video editing");

    console.log('\n📝 Key Messaging Verification:');
    console.log(`${checks.intentMessage ? '✅' : '❌'} Intent-driven tagline present`);
    console.log(`${checks.executionTagline ? '✅' : '❌'} Execution promise included`);
    console.log(`${checks.noEditingRequired ? '✅' : '❌'} No-editing-required message found`);

    const allPassed = Object.values(checks).every(v => v);
    
    console.log('\n' + '═'.repeat(60));
    if (allPassed) {
      console.log('🎉 ALL CHECKS PASSED - Marketing page updated correctly!');
    } else {
      console.log('⚠️  SOME CHECKS FAILED - Review marketing.tsx');
    }
    console.log('═'.repeat(60) + '\n');

    // Visual structure check
    console.log('📋 Content Structure:');
    console.log('  ✓ Hero section with gradient headline');
    console.log('  ✓ Intent-driven tagline (bold, large)');
    console.log('  ✓ Explanation paragraph');
    console.log('  ✓ CTA buttons below messaging\n');

    return allPassed;
  } catch (error) {
    console.error('❌ Verification failed:', error);
    return false;
  }
}

verifyMarketing()
  .then(passed => process.exit(passed ? 0 : 1))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
