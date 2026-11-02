import { MongoClient } from "mongodb";

// DESTRUCTIVE: deletes all subjects, chapters, students and exams before re-inserting demo data.
// Run with: node --env-file=.env.local scripts/seed-atlas.mjs --confirm-wipe
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set. Run with --env-file=.env.local");
  process.exit(1);
}
if (!process.argv.includes("--confirm-wipe")) {
  console.error("This script DELETES all students, exams, subjects and chapters. Re-run with --confirm-wipe if you really mean it.");
  process.exit(1);
}

const biologyChapters = [
  "Animal Tissue",
  "Biodiversity Conservation and Environmental Issues",
  "Biomolecules",
  "Biotechnology",
  "Cell Division",
  "Cell Structure and Organization",
  "Control and Co-ordination",
  "Ecosystems and Energy Flow",
  "Enhancement of Food Production",
  "Excretion and Osmoregulation",
  "Human Health and Diseases",
  "Human Nutrition",
  "Inheritance and Variation",
  "Kingdom Animalia",
  "Kingdom Plantae",
  "Molecular Basis of Inheritance",
  "Morphology of Flowering Plants",
  "Organisms and Populations",
  "Origin and Evolution of Life",
  "Photosynthesis",
  "Plant Growth and Mineral Nutrition",
  "Plant Tissues and Anatomy",
  "Plant Water Relation",
  "Reproduction in Lower and Higher Animals",
  "Reproduction in Lower and Higher Plants",
  "Respiration and Circulation",
  "Respiration and Energy Transfer",
  "Skeleton and Movement",
  "Study of Animal Type(Cockroach)",
  "Systematics of Living Organisms",
  "The Living World"
];

const chemistryChapters = [
  "Alcohols Phenols and Ethers",
  "Aldehydes Ketones and Carboxylic Acids",
  "Amines",
  "Biomolecules",
  "Chemical Bonding and Molecular Structure",
  "Chemical Equilibrium",
  "Chemical Kinetics",
  "Chemistry in Everyday Life",
  "Coordination Compounds",
  "d & f Block Elements",
  "Electrochemistry",
  "Environmental Chemistry",
  "General Organic Chemistry",
  "Haloalkanes and Haloarenes",
  "Hydrocarbons",
  "Hydrogen",
  "Ionic Equilibrium",
  "Metallurgy",
  "p Block(Group 13 & 14) Elements",
  "p Block(Group 15 - 18) Elements",
  "Periodic Table",
  "Polymers",
  "Practical Chemistry",
  "Redox Reactions",
  "s Block Elements",
  "Solid State",
  "Solutions and Colligative Properties",
  "Some Basic Concepts of Chemistry",
  "States of Matter",
  "Structure of Atom",
  "Surface Chemistry",
  "Thermodynamics (C)",
  "Nuclear Chemistry & Reaction Mechanisms"
];

const mathChapters = [
  "Application of Derivatives",
  "Area Under Curves",
  "Basic of Mathematics",
  "Binomial Theorem",
  "Circle",
  "Complex Number",
  "Continuity and Differentiability",
  "Definite Integration",
  "Determinants",
  "Differential Equation",
  "Differentiation",
  "Ellipse",
  "Functions",
  "Heights and Distance",
  "Hyperbola",
  "Indefinite Integration",
  "Inverse Trigonometric Functions",
  "Limits",
  "Linear Programming",
  "Mathematical Logic",
  "Matrices",
  "Pair of Lines",
  "Parabola",
  "Permutation and Combination",
  "Probability",
  "Properties of Triangle",
  "Quadratic Equation",
  "Sequence and Series",
  "Sets and Relations",
  "Statistics",
  "Straight Line",
  "Three Dimensional Geometry",
  "Trigonometry",
  "Vector Algebra"
];

const physicsChapters = [
  "Alternating Current",
  "Capacitance",
  "Center of Mass Momentum and Collision",
  "Circular Motion",
  "Communication Systems",
  "Current Electricity",
  "Dual Nature of Matter",
  "Electromagnetic Induction",
  "Electromagnetic Waves",
  "Electrostatics",
  "Fluid Mechanics",
  "Gravitation",
  "Kinetic Theory of Gases",
  "Laws of Motion and Friction",
  "Magnetic Effects of Current",
  "Magnetic Properties of Matter",
  "Mathematical Tools",
  "Mechanical Properties of Solids",
  "Motion in One Dimension",
  "Motion in Two Dimension",
  "Nuclear Physics",
  "Oscillations",
  "Ray Optics",
  "Rotational Motion",
  "Semiconductors",
  "Thermal Properties of Matter",
  "Thermodynamics (P)",
  "Units and Dimensions",
  "Vectors",
  "Wave Optics",
  "Waves and Sound",
  "Work Power & Energy"
];

const foundationChapters = [
  "Bridge Course & Fundamentals of Science"
];

// Subjects list matching Screenshot 2
const subjectsData = [
  {
    id: "biology",
    name: "Biology",
    icon: "🧬",
    color: "#f59e0b", // Yellow
    chaptersCount: biologyChapters.length,
    questionsCount: 1750,
    created: "Oct 28, 2026",
    updated: "Nov 02, 2026"
  },
  {
    id: "chemistry",
    name: "Chemistry",
    icon: "🧪",
    color: "#3b82f6", // Blue
    chaptersCount: chemistryChapters.length,
    questionsCount: 2587,
    created: "Oct 28, 2026",
    updated: "Nov 02, 2026"
  },
  {
    id: "foundation",
    name: "Foundation",
    icon: "📖",
    color: "#1d4ed8", // Deep Blue
    chaptersCount: foundationChapters.length,
    questionsCount: 25,
    created: "Oct 15, 2026",
    updated: "Nov 02, 2026"
  },
  {
    id: "mathematics",
    name: "Mathematics",
    icon: "➗",
    color: "#22c55e", // Green
    chaptersCount: mathChapters.length,
    questionsCount: 1597,
    created: "Oct 28, 2026",
    updated: "Nov 02, 2026"
  },
  {
    id: "physics",
    name: "Physics",
    icon: "⚛️",
    color: "#ef4444", // Red
    chaptersCount: physicsChapters.length,
    questionsCount: 2365,
    created: "Oct 28, 2026",
    updated: "Nov 02, 2026"
  }
];

// Helper to generate chapter documents
function makeChapters(subjectId, list) {
  return list.map((name, idx) => ({
    id: `${subjectId}-${idx + 1}`,
    subjectId,
    name,
    order: idx + 1,
    questionsCount: Math.floor(40 + ((idx * 17) % 65)),
    created: "Oct 28, 2026",
    updated: "Nov 02, 2026"
  }));
}

function generateStudents(target = 1518) {
  const result = [];
  const firstNames = [
    "Abhay", "Abhishek", "Aditi", "Aditya", "Akanksha", "Akshay", "Amit", "Ananya", "Aniket", "Anjali",
    "Ankita", "Atharva", "Ayush", "Bhavesh", "Chetan", "Chinmay", "Darshan", "Deepak", "Devendra", "Digvijay",
    "Divya", "Ganesh", "Gaurav", "Harsh", "Harshada", "Isha", "Ishaan", "Jay", "Kalyani", "Karan",
    "Kaustubh", "Kunal", "Mahesh", "Manish", "Mayur", "Mihir", "Mohit", "Neha", "Nikhil", "Nilesh",
    "Omkar", "Pooja", "Pranav", "Prasad", "Prathamesh", "Priya", "Rahul", "Rohan", "Rohit", "Rushikesh"
  ];
  const lastNames = [
    "Patil", "Deshmukh", "Kulkarni", "Jadhav", "Pawar", "Shinde", "More", "Chavan", "Gaekwad", "Bhosale",
    "Kale", "Wagh", "Kadam", "Rathod", "Sawant", "Gore", "Nikam", "Gaikwad", "Tambe", "Ghuge"
  ];
  const batches = [
    "Testing", "AS Outer Crash 2026", "RE-NEET 2026", "AS 12th CET 26-27",
    "IN 12th CET 26-27", "12th JEE RRTS", "11th CET CBT", "Unknown"
  ];

  for (let i = result.length; i < target; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[(i * 3) % lastNames.length];
    const batch = batches[(i * 5) % batches.length];
    const idNum = 20260000 + ((i * 137 + 1024) % 9999);
    const phone = `9${Math.floor(100000000 + ((i * 74839) % 899999999))}`;
    const day = (i % 28) + 1;

    result.push({
      id: `RR${idNum}`,
      name: `${fn} ${ln}`,
      email: i % 5 === 0 ? `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com` : "-",
      phone: phone.padEnd(10, "0"),
      batch,
      dob: "-",
      created: `10/${day > 9 ? day : '0' + day}/2026`,
      status: "active"
    });
  }
  return result;
}

const examsData = [
  {
    id: "exam-1",
    title: "12th JEE RRTS PCM Test 09 (26-10-2026)",
    created: "Oct 24, 2026",
    attempts: 43,
    avgScore: 0.0,
    completion: 0.0,
    subject: "Physics + Chemistry + Math"
  },
  {
    id: "exam-2",
    title: "JEE CBT 05 (26-10-26)",
    created: "Oct 24, 2026",
    attempts: 58,
    avgScore: 0.0,
    completion: 0.0,
    subject: "JEE Mains"
  },
  {
    id: "exam-3",
    title: "12CET Physics Test (18-10-2026)",
    created: "Oct 17, 2026",
    attempts: 219,
    avgScore: 0.0,
    completion: 0.0,
    subject: "Physics"
  },
  {
    id: "exam-4",
    title: "12 CET Biology Test 14-10-2026",
    created: "Oct 12, 2026",
    attempts: 90,
    avgScore: 0.0,
    completion: 0.0,
    subject: "Biology"
  },
  {
    id: "exam-5",
    title: "RRGJC 11CET CBT 01 (12-10-2026)",
    created: "Oct 10, 2026",
    attempts: 145,
    avgScore: 0.0,
    completion: 0.0,
    subject: "CET Combined"
  }
];

async function seed() {
  const client = new MongoClient(uri);
  try {
    console.log("Connecting to MongoDB Atlas...");
    await client.connect();
    console.log("Connected!");

    const db = client.db("ramraj_exam_portal");

    // 1. Subjects
    console.log("Seeding subjects...");
    await db.collection("subjects").deleteMany({});
    await db.collection("subjects").insertMany(subjectsData);
    console.log(`Inserted ${subjectsData.length} subjects.`);

    // 2. Chapters
    console.log("Seeding chapters...");
    const allChapters = [
      ...makeChapters("biology", biologyChapters),
      ...makeChapters("chemistry", chemistryChapters),
      ...makeChapters("foundation", foundationChapters),
      ...makeChapters("mathematics", mathChapters),
      ...makeChapters("physics", physicsChapters)
    ];
    await db.collection("chapters").deleteMany({});
    await db.collection("chapters").insertMany(allChapters);
    console.log(`Inserted ${allChapters.length} chapters.`);

    // 3. Students
    console.log("Seeding students (1518)...");
    const students = generateStudents(1518);
    await db.collection("students").deleteMany({});
    await db.collection("students").insertMany(students);
    console.log(`Inserted ${students.length} students.`);

    // 4. Exams
    console.log("Seeding exams...");
    await db.collection("exams").deleteMany({});
    await db.collection("exams").insertMany(examsData);
    console.log(`Inserted ${examsData.length} exams.`);

    console.log("MongoDB Atlas database seeded successfully with latest dates!");
  } catch (err) {
    console.error("Seeding error:", err);
  } finally {
    await client.close();
  }
}

seed();
