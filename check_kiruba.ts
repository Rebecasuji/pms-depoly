import { db } from './server/db';
import { employees, users } from './shared/schema';
import { eq } from 'drizzle-orm';

async function checkKiruba() {
  try {
    console.log('🔍 Looking for KIRUBA (E0054)...');
    
    // Find employee E0054
    const emp = await db.select().from(employees).where(eq(employees.empCode, 'E0054'));
    console.log('Employee found:', emp);
    
    if (emp.length === 0) {
      console.log('❌ Employee E0054 not found in database');
      process.exit(1);
    }
    
    const empId = emp[0].id;
    console.log(`✓ Employee ID: ${empId}, Name: ${emp[0].name}, Department: ${emp[0].department}`);
    
    // Check for user account
    const user = await db.select().from(users).where(eq(users.employeeId, empId));
    
    if (user.length === 0) {
      console.log(`❌ ISSUE: No user account linked to ${emp[0].name} (${emp[0].empCode})`);
      console.log('   → User needs to be created or imported');
    } else {
      console.log(`✓ User found: ${user[0].username}, Role: ${user[0].role}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkKiruba();
