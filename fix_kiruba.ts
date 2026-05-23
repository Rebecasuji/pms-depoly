import { db } from './server/db';
import { employees } from './shared/schema';
import { eq } from 'drizzle-orm';

async function fixKiruba() {
  try {
    // Find KIRUBA by name
    const kiruba = await db.select().from(employees).where(eq(employees.name, 'KIRUBA'));
    
    if (kiruba.length === 0) {
      console.log('❌ KIRUBA not found');
      return;
    }
    
    console.log('Found KIRUBA:', kiruba[0]);
    
    // Update emp_code to E0054
    const result = await db.update(employees)
      .set({ empCode: 'E0054' })
      .where(eq(employees.id, kiruba[0].id));
    
    console.log('✅ Updated KIRUBA emp_code to E0054');
    
    // Verify
    const updated = await db.select().from(employees).where(eq(employees.id, kiruba[0].id));
    console.log('Verified:', updated[0]);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixKiruba();
