import fetch from "node-fetch";

async function testCreateProject() {
  const payload = {
    title: "Test Project",
    projectCode: "TST-001",
    description: "This is a test project",
    clientName: "Test Client",
    status: "open",
    startDate: "2025-01-28",
    endDate: "2025-12-31",
    progress: 0,
    department: ["Engineering", "Design"],
    team: [],
    vendors: [],
  };

  try {
    console.log("📤 Creating project with payload:", JSON.stringify(payload, null, 2));

    const response = await fetch("http://localhost:5000/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.status === 200) {
      console.log("✅ Project created successfully!");
      console.log("📦 Response:", JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ Error (${response.status}):`, JSON.stringify(data, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    process.exit(1);
  }
}

testCreateProject();
