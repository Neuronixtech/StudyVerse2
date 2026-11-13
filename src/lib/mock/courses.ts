import type { Course, CourseModule, Lesson } from "../types";
import { DAY } from "../utils";

type LessonSpec = [title: string, minutes: number, seconds: number, preview?: boolean];

function mod(courseKey: string, index: number, title: string, lessons: LessonSpec[]): CourseModule {
  const moduleId = `${courseKey}-m${index + 1}`;
  return {
    id: moduleId,
    title,
    lessons: lessons.map(([t, m, s, preview], i): Lesson => {
      const id = `${moduleId}-l${i + 1}`;
      return {
        id,
        title: t,
        description: `In this lesson we cover ${t.toLowerCase()} with worked examples, common traps seen in previous JEE papers and a short recap at the end.`,
        durationSec: m * 60 + s,
        isPreview: Boolean(preview),
        video: i % 3 === 2 ? { kind: "url", ref: `https://videos.example.com/${id}` } : { kind: "upload", ref: `${id}.mp4` },
      };
    }),
  };
}

export function seedCourses(anchor: number): Course[] {
  const ago = (days: number) => anchor - days * DAY;

  return [
    {
      id: "c-mechanics",
      slug: "jee-physics-mechanics",
      title: "JEE Physics: Mechanics Masterclass",
      subtitle: "Build rock-solid fundamentals in kinematics, laws of motion and energy.",
      description:
        "A structured, concept-first journey through classical mechanics — the highest-weightage block in JEE Physics. Every chapter pairs short concept videos with solved previous-year questions, so you learn the idea and immediately see how examiners test it.",
      theme: "teal",
      subjectIds: ["physics"],
      examIds: ["jee-main", "jee-advanced"],
      level: "Intermediate",
      instructor: { name: "Dr. Ananya Krishnan", title: "Physics faculty · 12 yrs teaching" },
      status: "published",
      featured: true,
      highlights: [
        "48 solved previous-year questions",
        "Free-body diagram drills",
        "Chapter-wise practice tests",
        "Formula sheet for quick revision",
      ],
      rating: 4.9,
      ratingCount: 1284,
      enrolled: 8420,
      createdAt: ago(210),
      updatedAt: ago(6),
      modules: [
        mod("c-mechanics", 0, "Units, Dimensions & Errors", [
          ["Welcome: how to use this course", 6, 20, true],
          ["SI units and dimensional analysis", 18, 45],
          ["Errors in measurement", 22, 10],
        ]),
        mod("c-mechanics", 1, "Kinematics", [
          ["Motion in a straight line", 24, 30],
          ["Graphs of motion", 19, 5],
          ["Projectile motion", 27, 40],
          ["Relative velocity", 21, 15],
        ]),
        mod("c-mechanics", 2, "Laws of Motion", [
          ["Newton's laws and free-body diagrams", 26, 0],
          ["Friction", 23, 30],
          ["Circular motion dynamics", 25, 10],
        ]),
        mod("c-mechanics", 3, "Work, Energy & Power", [
          ["Work–energy theorem", 20, 40],
          ["Conservative forces and potential energy", 22, 55],
          ["Power and collisions", 28, 20],
        ]),
      ],
    },
    {
      id: "c-organic",
      slug: "organic-chemistry-mechanisms",
      title: "Organic Chemistry: Reaction Mechanisms Decoded",
      subtitle: "Stop memorising reactions — understand why they happen.",
      description:
        "Organic chemistry becomes predictable once you understand electron movement. This course builds from electronic effects to named reactions, with mechanism maps you can revise in minutes before the exam.",
      theme: "violet",
      subjectIds: ["chemistry"],
      examIds: ["jee-main", "jee-advanced"],
      level: "Intermediate",
      instructor: { name: "Rahul Bhatia", title: "Chemistry mentor · ex-Kota faculty" },
      status: "published",
      featured: true,
      highlights: ["Mechanism maps for 60+ reactions", "Reagent cheat sheets", "Named reactions drill", "Isomerism masterclass"],
      rating: 4.8,
      ratingCount: 962,
      enrolled: 6110,
      createdAt: ago(180),
      updatedAt: ago(12),
      modules: [
        mod("c-organic", 0, "General Organic Chemistry", [
          ["Electronic effects explained", 21, 30, true],
          ["Reaction intermediates", 24, 15],
          ["Acidity and basicity", 19, 40],
        ]),
        mod("c-organic", 1, "Hydrocarbons", [
          ["Alkanes and conformations", 18, 20],
          ["Alkenes: electrophilic addition", 26, 45],
          ["Alkynes and aromatic compounds", 23, 5],
        ]),
        mod("c-organic", 2, "Haloalkanes & Haloarenes", [
          ["SN1 vs SN2", 25, 30],
          ["Elimination reactions", 20, 10],
        ]),
        mod("c-organic", 3, "Alcohols, Phenols & Ethers", [
          ["Preparation and properties of alcohols", 22, 40],
          ["Phenols and their reactions", 19, 55],
          ["Ethers and epoxides", 16, 30],
        ]),
      ],
    },
    {
      id: "c-calculus",
      slug: "calculus-for-jee",
      title: "Calculus for JEE: Limits to Integrals",
      subtitle: "From first principles to definite integrals, step by step.",
      description:
        "Calculus carries the largest share of JEE Mathematics. This course takes you from limits and continuity through differentiation, applications of derivatives and integration, with speed techniques for MCQ and numerical questions.",
      theme: "amber",
      subjectIds: ["mathematics"],
      examIds: ["jee-main", "jee-advanced", "mht-cet"],
      level: "Intermediate",
      instructor: { name: "Neha Kulkarni", title: "Mathematics faculty · IIT Delhi alumna" },
      status: "published",
      featured: true,
      highlights: ["Graph-first intuition", "Shortcut methods for MCQs", "200+ practice problems", "Definite integral properties"],
      rating: 4.9,
      ratingCount: 1530,
      enrolled: 9875,
      createdAt: ago(240),
      updatedAt: ago(3),
      modules: [
        mod("c-calculus", 0, "Limits & Continuity", [
          ["What is a limit? An intuitive start", 15, 50, true],
          ["Standard limits and L'Hôpital's rule", 24, 20],
          ["Continuity and differentiability", 22, 5],
        ]),
        mod("c-calculus", 1, "Differentiation", [
          ["Rules of differentiation", 20, 30],
          ["Implicit and parametric differentiation", 23, 40],
        ]),
        mod("c-calculus", 2, "Applications of Derivatives", [
          ["Tangents and normals", 18, 15],
          ["Maxima and minima", 27, 30],
          ["Monotonicity", 19, 45],
        ]),
        mod("c-calculus", 3, "Integration", [
          ["Indefinite integrals: standard forms", 25, 10],
          ["Integration by parts and partial fractions", 28, 0],
          ["Definite integrals and properties", 26, 35],
          ["Area under curves", 21, 20],
        ]),
      ],
    },
    {
      id: "c-coordinate",
      slug: "coordinate-geometry",
      title: "Coordinate Geometry Crash Course",
      subtitle: "Straight lines, circles and conics — fast, visual and exam-ready.",
      description:
        "A compact, high-yield course on coordinate geometry built around visual intuition and standard results. Ideal for the final months before JEE Main.",
      theme: "sky",
      subjectIds: ["mathematics"],
      examIds: ["jee-main", "mht-cet"],
      level: "Foundation",
      instructor: { name: "Neha Kulkarni", title: "Mathematics faculty · IIT Delhi alumna" },
      status: "published",
      featured: true,
      highlights: ["Standard results summary", "Parametric forms made simple", "Locus problems", "Timed practice sets"],
      rating: 4.7,
      ratingCount: 688,
      enrolled: 4320,
      createdAt: ago(150),
      updatedAt: ago(20),
      modules: [
        mod("c-coordinate", 0, "Straight Lines", [
          ["Slope, intercepts and forms of a line", 17, 30, true],
          ["Angle between lines and distance formulas", 21, 0],
        ]),
        mod("c-coordinate", 1, "Circles", [
          ["Equation of a circle", 19, 25],
          ["Tangents and chords", 23, 15],
        ]),
        mod("c-coordinate", 2, "Conic Sections", [
          ["Parabola", 24, 40],
          ["Ellipse", 22, 30],
          ["Hyperbola", 20, 50],
        ]),
      ],
    },
    {
      id: "c-electro",
      slug: "electrostatics-current-electricity",
      title: "Electrostatics & Current Electricity",
      subtitle: "Fields, potentials, capacitors and circuits with clarity.",
      description:
        "Master the electricity chapters that appear in every JEE paper. Concepts are built with field-line visualisations, followed by circuit-solving strategies that save time in the exam.",
      theme: "emerald",
      subjectIds: ["physics"],
      examIds: ["jee-main", "jee-advanced"],
      level: "Advanced",
      instructor: { name: "Dr. Ananya Krishnan", title: "Physics faculty · 12 yrs teaching" },
      status: "published",
      featured: true,
      highlights: ["Gauss's law applications", "Capacitor networks", "Kirchhoff's law shortcuts", "Meter bridge & potentiometer"],
      rating: 4.8,
      ratingCount: 731,
      enrolled: 5210,
      createdAt: ago(120),
      updatedAt: ago(9),
      modules: [
        mod("c-electro", 0, "Electric Charges & Fields", [
          ["Coulomb's law and superposition", 20, 15, true],
          ["Electric field and field lines", 22, 40],
          ["Gauss's law", 26, 10],
        ]),
        mod("c-electro", 1, "Potential & Capacitance", [
          ["Electric potential and energy", 24, 0],
          ["Capacitors and dielectrics", 25, 35],
        ]),
        mod("c-electro", 2, "Current Electricity", [
          ["Ohm's law and resistivity", 18, 45],
          ["Kirchhoff's laws", 23, 20],
          ["Wheatstone bridge and potentiometer", 21, 55],
        ]),
      ],
    },
    {
      id: "c-physchem",
      slug: "physical-chemistry-numericals",
      title: "Physical Chemistry Numericals Bootcamp",
      subtitle: "Score-boosting numericals from mole concept to electrochemistry.",
      description:
        "Physical chemistry is the most scoring part of JEE Chemistry if your numerical method is sound. This bootcamp drills a repeatable approach for every chapter.",
      theme: "rose",
      subjectIds: ["chemistry"],
      examIds: ["jee-main", "mht-cet"],
      level: "Foundation",
      instructor: { name: "Rahul Bhatia", title: "Chemistry mentor · ex-Kota faculty" },
      status: "published",
      featured: true,
      highlights: ["Unit-analysis method", "Log tables practice", "Equilibrium ICE tables", "Numerical answer drills"],
      rating: 4.7,
      ratingCount: 540,
      enrolled: 3980,
      createdAt: ago(100),
      updatedAt: ago(15),
      modules: [
        mod("c-physchem", 0, "Mole Concept", [
          ["Moles, molar mass and stoichiometry", 19, 30, true],
          ["Concentration terms", 21, 10],
        ]),
        mod("c-physchem", 1, "Thermodynamics", [
          ["First law and enthalpy", 24, 20],
          ["Entropy and Gibbs energy", 22, 45],
        ]),
        mod("c-physchem", 2, "Chemical Equilibrium", [
          ["Kc, Kp and Le Chatelier's principle", 23, 0],
          ["Ionic equilibrium and pH", 26, 30],
        ]),
        mod("c-physchem", 3, "Electrochemistry", [
          ["Electrochemical cells and EMF", 22, 15],
          ["Nernst equation", 20, 40],
        ]),
      ],
    },
    {
      id: "c-mhtcet",
      slug: "mht-cet-pcm-revision",
      title: "MHT-CET Complete PCM Revision",
      subtitle: "A fast, syllabus-aligned revision of Physics, Chemistry and Maths.",
      description:
        "Designed for the MHT-CET pattern: no negative marking, speed-focused, state-board aligned. Revise every chapter with crisp summaries and exam strategy sessions.",
      theme: "teal",
      subjectIds: ["physics", "chemistry", "mathematics"],
      examIds: ["mht-cet"],
      level: "Foundation",
      instructor: { name: "Sanjay Patwardhan", title: "MHT-CET specialist · Pune" },
      status: "published",
      featured: false,
      highlights: ["State-board aligned", "Speed strategy", "Chapter summaries", "Full-length practice"],
      rating: 4.6,
      ratingCount: 410,
      enrolled: 2870,
      createdAt: ago(90),
      updatedAt: ago(30),
      modules: [
        mod("c-mhtcet", 0, "Physics Rapid Revision", [
          ["Exam pattern and strategy", 12, 40, true],
          ["Rotational dynamics in 25 minutes", 25, 0],
          ["Wave optics summary", 21, 30],
        ]),
        mod("c-mhtcet", 1, "Chemistry Rapid Revision", [
          ["Solid state and solutions", 22, 10],
          ["Coordination compounds summary", 19, 50],
        ]),
        mod("c-mhtcet", 2, "Maths Rapid Revision", [
          ["Matrices and determinants", 20, 20],
          ["Probability distributions", 18, 35],
        ]),
      ],
    },
    {
      id: "c-inorganic",
      slug: "inorganic-chemistry",
      title: "Inorganic Chemistry: Periodic Table to Coordination",
      subtitle: "Trends, bonding and coordination compounds without rote learning.",
      description:
        "Inorganic chemistry rewards pattern recognition. Learn the periodic trends, bonding models and block-wise chemistry through tables and logic you can reconstruct in the exam hall.",
      theme: "violet",
      subjectIds: ["chemistry"],
      examIds: ["jee-main", "jee-advanced"],
      level: "Intermediate",
      instructor: { name: "Farah Siddiqui", title: "Chemistry faculty · 9 yrs teaching" },
      status: "published",
      featured: false,
      highlights: ["Periodic trend tables", "VSEPR shape practice", "p-block exceptions list", "Crystal field theory"],
      rating: 4.7,
      ratingCount: 377,
      enrolled: 2440,
      createdAt: ago(80),
      updatedAt: ago(18),
      modules: [
        mod("c-inorganic", 0, "Periodic Properties", [
          ["Periodic trends at a glance", 17, 45, true],
          ["Ionisation enthalpy and electron gain", 20, 30],
        ]),
        mod("c-inorganic", 1, "Chemical Bonding", [
          ["VSEPR theory and shapes", 25, 15],
          ["Hybridisation and MOT", 27, 40],
        ]),
        mod("c-inorganic", 2, "Coordination Compounds", [
          ["Nomenclature and isomerism", 23, 0],
          ["Crystal field theory", 24, 25],
        ]),
      ],
    },
    {
      id: "c-modern",
      slug: "modern-physics-advanced",
      title: "Modern Physics for JEE Advanced",
      subtitle: "Photoelectric effect, atoms and nuclei — coming soon.",
      description: "Draft course being prepared by the content team. Not visible in the public catalog.",
      theme: "sky",
      subjectIds: ["physics"],
      examIds: ["jee-advanced"],
      level: "Advanced",
      instructor: { name: "Dr. Ananya Krishnan", title: "Physics faculty · 12 yrs teaching" },
      status: "draft",
      featured: false,
      highlights: ["Photoelectric effect", "Bohr model", "Radioactivity"],
      rating: 0,
      ratingCount: 0,
      enrolled: 0,
      createdAt: ago(10),
      updatedAt: ago(1),
      modules: [
        mod("c-modern", 0, "Dual Nature of Radiation", [
          ["Photoelectric effect", 22, 0, true],
          ["de Broglie wavelength", 18, 30],
        ]),
        mod("c-modern", 1, "Atoms & Nuclei", [["Bohr model of hydrogen", 24, 10]]),
      ],
    },
    {
      id: "c-revision25",
      slug: "jee-main-2025-revision",
      title: "JEE Main 2025 Last-Mile Revision",
      subtitle: "Archived revision series from the 2025 session.",
      description: "Archived after the 2025 session. Retained for learner history and administrative reference.",
      theme: "amber",
      subjectIds: ["physics", "chemistry", "mathematics"],
      examIds: ["jee-main"],
      level: "Intermediate",
      instructor: { name: "StudyVerse Faculty", title: "Combined faculty team" },
      status: "archived",
      featured: false,
      highlights: ["High-yield topics", "Formula recap"],
      rating: 4.5,
      ratingCount: 902,
      enrolled: 7020,
      createdAt: ago(400),
      updatedAt: ago(160),
      modules: [
        mod("c-revision25", 0, "Physics Recap", [
          ["Top 20 formulas", 15, 0, true],
          ["Most repeated topics", 19, 20],
        ]),
        mod("c-revision25", 1, "Chemistry Recap", [["NCERT one-liners", 21, 10]]),
      ],
    },
  ];
}
