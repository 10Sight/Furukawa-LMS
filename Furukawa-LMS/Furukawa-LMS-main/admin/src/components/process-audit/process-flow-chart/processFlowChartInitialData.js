/**
 * Process Flow Chart Initial Data
 * Extracted directly from: 01_PFC YHB Floor.xls (Rev. 05)
 * Furukawa Minda Electric Pvt. Ltd.
 */

export const PFC_PART_NUMBERS = [
  "36630-75U00",
  "36630-75U10",
  "36630-75U20",
  "36630-75U30",
  "36630-75U40",
  "36630-75U50",
  "36630-75U60",
  "36630-75U70",
  "36630-75U80",
  "36630-75U90",
  "36630-75UB0",
  "36630-75UC0",
  "36630-75UD0",
  "36630-75UP0",
  "36603-75U00",
  "36603-75U10",
  "36603-75U20",
  "36603-75U30",
  "36603-75U40",
  "36630-75UF0",
  "36630-75UG0",
  "36630-75UH0"
];

export const INITIAL_PFC_METADATA = {
  companyName: 'FURUKAWA MINDA ELECTRIC PVT. LTD.',
  title: 'Process Flow Chart',
  docType: 'Production', // Prototype | Prelaunch | Production
  customerName: 'Maruti Suzuki India Limited',
  partNumber: '36603-75U**/36630-75U**',
  issueLevel: '05',
  designNoteNo: 'As per design change table',
  supplierPlant: 'Plot 325,326, Sector3, GC Bawal, Ph.-2, Dist: Rewari, Haryana',
  partName: 'HARNESS ASSY FLOOR',
  pfcDateOriginal: '02.07.2024',
  revDate: '11.09.2026',
  drawingLevel: 'As per design change table',
  supplierCode: 'F241',
  project: 'YHB/C_RC25',
  pfcKeyDate: '15.09.2026',
  reasonForReissue: 'YHB RC25 ECN Part add',
  pfcNo: 'PFC-WH-PE-MSIL-YHB -002',
};

export const INITIAL_PFC_REVISION_HISTORY = [
  { revNo: '00', revDate: '02-07-2024', changeContent: 'New creation for PPT event', remarks: 'Prototype' },
  { revNo: '01', revDate: '15-11-2024', changeContent: 'New creation for MPT event', remarks: 'Prelaunch' },
  { revNo: '02', revDate: '25-03-2025', changeContent: 'New creation for PILOT event', remarks: 'Prelaunch' },
  { revNo: '03', revDate: '21-04-2025', changeContent: 'New creation for SOP', remarks: 'Production' },
  { revNo: '04', revDate: '15-06-2026', changeContent: 'Wire stripping length mark as critical process as per Customer Guideline', remarks: 'Customer Guideline' },
  { revNo: '05', revDate: '11-09-2026', changeContent: 'YHB RC25 ECN Part add', remarks: 'Production' },
];

export const INITIAL_PFC_SIGN_OFF = {
  plantLevel: {
    projectLeader: 'Jitendra Kumar',
    processEngineering: 'Anuj Yadav',
    qa: 'Arvind',
    production: 'Sushil',
    maintenance: 'Marut',
    logistic: 'Sunil',
    purchase: 'Dipendra',
  },
  centralizeLevel: {
    processEngineeringCentralize: 'Manoj Kumar',
    qualityCentralize: 'Yadvendar Yadav',
  },
};

export const INITIAL_PFC_ROWS = [
  {
    "id": "pfc_row_14",
    "opNo": "10",
    "procName": "Material Receiving",
    "incoming": "",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 1,
    "charProduct": "Parcel condition,Packing condition,Parcel Temporary Storage,Parcel handling / placement",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "center",
        "to": "bottom"
      }
    ],
    "hLines": [],
    "arrows": []
  },
  {
    "id": "pfc_row_15",
    "opNo": "20",
    "procName": "Material receiving inspection",
    "incoming": "Wrong measuring tool",
    "flowchartSymbol": "◇",
    "flowchartType": "inspection",
    "flowchartTrack": 1,
    "charProduct": "Inspection report  As per MISP",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [],
    "arrows": []
  },
  {
    "id": "pfc_row_16",
    "opNo": "25",
    "procName": "Material Storage & Issuuance",
    "incoming": "",
    "flowchartSymbol": "D",
    "flowchartType": "storage",
    "flowchartTrack": 1,
    "charProduct": "Material Identification,Material  placement,Material Issuance",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [],
    "arrows": []
  },
  {
    "id": "pfc_row_17",
    "opNo": "30",
    "procName": "Part Cutting",
    "incoming": "Wrong guide tube , Wrong pressure , damage blade, Wrong N-cot , VO, VS",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 2,
    "charProduct": "Length,size,Cutting condition,Slit VO,Tube type",
    "charProcess": "Air Pressure",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "Cutting Blade",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "center",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "center",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 3
      }
    ],
    "arrows": [
      {
        "track": 2,
        "direction": "down"
      },
      {
        "track": 3,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_18",
    "opNo": "40",
    "procName": "Auto cutting and crimping",
    "incoming": "Wrong Wire Type/color/size, Wrong Terminal,  Wrong tool (applicator and parts)",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 2,
    "charProduct": "Wire Type,Wire colour,Wire Size , Stripping Length ,Terminal,Type,Cutting Length ,Crimp Height ,Insulation Height",
    "charProcess": "CFA,GAMMA 253 & 252, Alpha355(Komax ) BLO Limit, All M/c(Air Pressure  (Main),All M/c Gripper Presure side - 1 & 2)",
    "spCustomer": "",
    "spInternal": "⟨C⟩",
    "inspection": "",
    "tools": "Applicator",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 2
      }
    ],
    "arrows": [
      {
        "track": 2,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_19",
    "opNo": "45",
    "procName": "Cutting & Stripping \n( Above 3.0mm & Shield wire )",
    "incoming": "Wrong Wire Type/color/size, Wrong Terminal,  Wrong tool (applicator and parts)",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 2,
    "charProduct": "Wire Type, Wire colour, Wire size, Cutting length, Stripping Length , Strand cut, Strand Pull Out",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "⟨C⟩",
    "inspection": "",
    "tools": "Cutting & Stripping Blade",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "X",
      "36630-75U10": "X",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "X",
      "36630-75U50": "√",
      "36630-75U60": "X",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "X",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "X",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 3
      }
    ],
    "arrows": [
      {
        "track": 3,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_20",
    "opNo": "50",
    "procName": "QC inspection (Auto)",
    "incoming": "Wrong measuring tool",
    "flowchartSymbol": "◇",
    "flowchartType": "inspection",
    "flowchartTrack": 2,
    "charProduct": "Inspection Result, Cut, crack, flash, rust Inspection",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 2,
        "toTrack": 3
      }
    ],
    "arrows": []
  },
  {
    "id": "pfc_row_21",
    "opNo": "60",
    "procName": "Shield wire preparation",
    "incoming": "Wrong Wire type/Wrong Cutting Length",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 3,
    "charProduct": "Wire Type ,Cutting length,",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "Wire Guide & Cutting Blade",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "X",
      "36630-75U10": "X",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "X",
      "36630-75U50": "√",
      "36630-75U60": "X",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "X",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "X",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [],
    "arrows": []
  },
  {
    "id": "pfc_row_22",
    "opNo": "65",
    "procName": "Sheath removing (ST MAC)",
    "incoming": "Wrong sheathing Length",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 5,
    "charProduct": "Sheath strip (removing) Length,Sheath strip  condition,",
    "charProcess": "ST-MAC\n( Main air pressure  )",
    "spCustomer": "",
    "spInternal": "⟨C⟩",
    "inspection": "",
    "tools": "Wire Guide & Strip Blade",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "X",
      "36630-75U10": "X",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "X",
      "36630-75U50": "√",
      "36630-75U60": "X",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "X",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "X",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "center",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 5
      }
    ],
    "arrows": [
      {
        "track": 5,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_23",
    "opNo": "70",
    "procName": "Shield wire stripping",
    "incoming": "Wrong Stripping Length",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 5,
    "charProduct": "Stripping Length,Stripping Position,Stripping condition",
    "charProcess": "Uni Strip\n( Main air pressure  )",
    "spCustomer": "",
    "spInternal": "⟨C⟩",
    "inspection": "",
    "tools": "Strip Blade",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "X",
      "36630-75U10": "X",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "X",
      "36630-75U50": "√",
      "36630-75U60": "X",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "X",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "X",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [],
    "arrows": []
  },
  {
    "id": "pfc_row_24",
    "opNo": "80",
    "procName": "Middle Stripping",
    "incoming": "Damaged blade/Wrong blade",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 5,
    "charProduct": "Stripping Length,Stripping Position,",
    "charProcess": "Main air Pressor in FRL Unit",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "Slit Blade",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [],
    "arrows": []
  },
  {
    "id": "pfc_row_25",
    "opNo": "85",
    "procName": "Middle Sliting (Only for CIVUS & HFSS wire)",
    "incoming": "Damaged blade/Wrong blade",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 4,
    "charProduct": "Sliting Length,Sliting Position,Sliting condition\n(Ripping off situation),Wire scratch",
    "charProcess": "Air pressure,Gripper/Operating pressure",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "Slit Blade",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 4,
        "from": "center",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 5
      }
    ],
    "arrows": [
      {
        "track": 4,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_26",
    "opNo": "90",
    "procName": "Parts fitting\n(Before Manual Crimping)",
    "incoming": "Wrong seal,cap & Tube",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 7,
    "charProduct": "Seal, Cap, Tube Type, Tube Size",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 4,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 7,
        "from": "center",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 7
      }
    ],
    "arrows": [
      {
        "track": 7,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_27",
    "opNo": "100",
    "procName": "Manual crimping",
    "incoming": "Wrong Wire Type, Wrong Wire Colour,Wire Size Less/More,Wrong Terminal,  Wrong applicator/Wrong anvil/Crimper",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 4,
    "charProduct": "Wire Type,Wire Size ,Terminal Type Crimp Height ,Insulation Height",
    "charProcess": "CFA (Crimp Force Analyser)",
    "spCustomer": "",
    "spInternal": "⟨C⟩",
    "inspection": "",
    "tools": "Applicator",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 4,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 7,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 4,
        "toTrack": 7
      }
    ],
    "arrows": []
  },
  {
    "id": "pfc_row_28",
    "opNo": "110",
    "procName": "QC inspection (manual crimping)",
    "incoming": "Cutting length less/More, Stripping length less/more, Crimp height less/more, Insulation height less/more, Strand cut/Strand Pullout,Pull strength less",
    "flowchartSymbol": "◇",
    "flowchartType": "inspection",
    "flowchartTrack": 4,
    "charProduct": "Inspection Result,Terminal\ncondition,",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 4,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 7,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 7
      }
    ],
    "arrows": []
  },
  {
    "id": "pfc_row_29",
    "opNo": "140",
    "procName": "Twist wire",
    "incoming": "Wrong wire Type, Damaged clamping fixture",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 5,
    "charProduct": "Twisting pitch length,Twist length,Wire combination selection,Terminal Damage,",
    "charProcess": "Machine setting",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "Holding Jig",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 4,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 7,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 7
      }
    ],
    "arrows": []
  },
  {
    "id": "pfc_row_30",
    "opNo": "150",
    "procName": "Joint crimping",
    "incoming": "Wrong Terminal,Wrong applicator",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 6,
    "charProduct": "Wrong assembly,Terminal Type,Crimp height,Joint terminal crimping",
    "charProcess": "BLO Limit\n(2T & 4T Mecal Press)",
    "spCustomer": "",
    "spInternal": "⟨C⟩",
    "inspection": "",
    "tools": "Applicator",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 4,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 6,
        "from": "center",
        "to": "bottom"
      },
      {
        "track": 7,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 4,
        "toTrack": 7
      }
    ],
    "arrows": [
      {
        "track": 6,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_31",
    "opNo": "160",
    "procName": "QC inspection (joint crimping)",
    "incoming": "Crimp height less/more, Conductor out,Pull stregth less",
    "flowchartSymbol": "◇",
    "flowchartType": "inspection",
    "flowchartTrack": 6,
    "charProduct": "Inspection Result,Terminal\ncondition",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 6,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 8,
        "from": "center",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 8
      }
    ],
    "arrows": [
      {
        "track": 8,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_32",
    "opNo": "190",
    "procName": "Resistance Welding",
    "incoming": "Wrong wire combination/Damaged tool/Machine jaw setting problem/Wrong Electrode",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 8,
    "charProduct": "Wire Type ,Wire Size,Welding Height,Welding Width,Welding condition,Pulling Strength",
    "charProcess": "Electrode Size,Air pressure",
    "spCustomer": "",
    "spInternal": "⟨C⟩",
    "inspection": "",
    "tools": "Electrode",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 6,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 8,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [],
    "arrows": []
  },
  {
    "id": "pfc_row_33",
    "opNo": "200",
    "procName": "QC inspection (Resistance welding)",
    "incoming": "Wrong Welding Width/Height/Pulling Strength",
    "flowchartSymbol": "◇",
    "flowchartType": "inspection",
    "flowchartTrack": 8,
    "charProduct": "Inspection Result,",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 6,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 8,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 9,
        "from": "center",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 9
      }
    ],
    "arrows": [
      {
        "track": 9,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_34",
    "opNo": "210",
    "procName": "Joint Taping",
    "incoming": "Wrong tape",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 8,
    "charProduct": "Tape Type",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 6,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 8,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 9,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [],
    "arrows": []
  },
  {
    "id": "pfc_row_35",
    "opNo": "230",
    "procName": "Heat shrink Tube assy",
    "incoming": "Wrong Size of tube",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 5,
    "charProduct": "Tube Size ,Tube Type",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    }
  },
  {
    "id": "pfc_row_36",
    "opNo": "235",
    "procName": "Dummy Seal Insertion",
    "incoming": "Wrong temp plate",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 9,
    "charProduct": "Seal Type",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 6,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 8,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 9,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 9
      }
    ],
    "arrows": []
  },
  {
    "id": "pfc_row_37",
    "opNo": "243",
    "procName": "Ferrite Fitting & Manual Crimping",
    "incoming": "Wrong Wire Type, Wrong Wire Colour,Wire Size Less/More,Wrong Terminal,  Wrong applicator/Wrong anvil/Crimper",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 7,
    "charProduct": "Ferrite Fitting Condition,Crimp Height ,Insulation Height, Stripping Length",
    "charProcess": "CFA, Air pressure",
    "spCustomer": "",
    "spInternal": "⟨C⟩",
    "inspection": "",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    }
  },
  {
    "id": "pfc_row_38",
    "opNo": "245",
    "procName": "Sub Assembly(Air Bag)",
    "incoming": "Wrong connector/VO/Clip/Wire",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 10,
    "charProduct": "Programme Selection,Wire Condition,Terminal insertion",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "⟨C⟩",
    "inspection": "",
    "tools": "PC Guidance Checker",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 6,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 8,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 9,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 10
      }
    ],
    "arrows": []
  },
  {
    "id": "pfc_row_39",
    "opNo": "250",
    "procName": "Sub Assembly",
    "incoming": "Wrong connector/VO/Clip/Wire/Secondary Lock,Grommet",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 10,
    "charProduct": "Wire condition,Terminal insertion/Terminal Backout,Tube insertion ,",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "PC Guidance Checker & Pull Checker",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 3,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 5,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 6,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 8,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 9,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 10
      }
    ],
    "arrows": []
  },
  {
    "id": "pfc_row_40",
    "opNo": "260",
    "procName": "Assembly",
    "incoming": "Wrong clamp/NCOT/VS/Slit/Secondary lock/Connector cover (CAP)/Name tag",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 10,
    "charProduct": "Branch Length,Specific Branch Length,Branch Direction,Branch Position,Component Type,Attach Part fitment",
    "charProcess": "Tensile strength (Band Gun)",
    "spCustomer": "",
    "spInternal": "⟨C⟩",
    "inspection": "",
    "tools": "Jig & Fixture",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 2,
        "from": "top",
        "to": "center"
      },
      {
        "track": 3,
        "from": "top",
        "to": "center"
      },
      {
        "track": 5,
        "from": "top",
        "to": "center"
      },
      {
        "track": 6,
        "from": "top",
        "to": "center"
      },
      {
        "track": 8,
        "from": "top",
        "to": "center"
      },
      {
        "track": 9,
        "from": "top",
        "to": "center"
      },
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 10
      }
    ],
    "arrows": [
      {
        "track": 10,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_41",
    "opNo": "262",
    "procName": "Clamp Attach / Protector fixing",
    "incoming": "Wrong clamp, Protector",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 10,
    "charProduct": "Clamp Type,Clamp Direction,Clamp Position,Clamp Tighten Condition,lead wire fixing with harness",
    "charProcess": "Tensile strength (Band Gun)",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "Fixture",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 10
      }
    ],
    "arrows": []
  },
  {
    "id": "pfc_row_42",
    "opNo": "270",
    "procName": "Dimension Inspection",
    "incoming": "Wrong Dimension inspection board",
    "flowchartSymbol": "◇",
    "flowchartType": "inspection",
    "flowchartTrack": 10,
    "charProduct": "Complete Inspection,Specific Branch Length inspection",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "⟨C⟩",
    "inspection": "○",
    "tools": "",
    "remarks": "IRDCS (Inspection record & defect control system)",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 10
      }
    ],
    "arrows": []
  },
  {
    "id": "pfc_row_43",
    "opNo": "280 & 290",
    "procName": "ECT inspection & Dummy Inspection",
    "incoming": "Wrong programme/Wrong checker\nSeal Interchange/ Wrong Dummy  template",
    "flowchartSymbol": "◇",
    "flowchartType": "inspection",
    "flowchartTrack": 10,
    "charProduct": "ECT Inspection,Continuity check  of lead wire by seperating from W/H,Lead wire Clamp presence checking, Presence check of Dummy",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "Checker",
    "remarks": "IRDCS and auto program selection",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 9,
        "from": "center",
        "to": "bottom"
      },
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 1,
        "toTrack": 10
      }
    ],
    "arrows": [
      {
        "track": 9,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_44",
    "opNo": "295",
    "procName": "Part presence Inspection",
    "incoming": "Wrong programme/Wrong checker",
    "flowchartSymbol": "◇",
    "flowchartType": "inspection",
    "flowchartTrack": 10,
    "charProduct": "Programme Selection,Part(Clamp/Connector Holder & Fuse) availability,Attached Part Inspection",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "Fixture",
    "remarks": "IRDCS and auto program selection",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 1,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 9,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 9,
        "toTrack": 10
      }
    ],
    "arrows": []
  },
  {
    "id": "pfc_row_45",
    "opNo": "330",
    "procName": "Optional Taping & Terminal Alignment",
    "incoming": "Wrong Tape",
    "flowchartSymbol": "O",
    "flowchartType": "operation",
    "flowchartTrack": 7,
    "charProduct": "Branch Fixation,Branch fixing direction,",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "",
    "remarks": "IRDCS (Inspection record & defect control system)",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    }
  },
  {
    "id": "pfc_row_46",
    "opNo": "340",
    "procName": "Visual Inspection",
    "incoming": "Wrong master sample",
    "flowchartSymbol": "◇",
    "flowchartType": "inspection",
    "flowchartTrack": 10,
    "charProduct": "Part Selection,Part Missing/ type/ wire color/ Position/ Dimension short / more / Foreign particle/Lock condition,Part Condition",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "",
    "remarks": "IRDCS (Inspection record & defect control system)",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 9,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 9,
        "toTrack": 10
      }
    ],
    "arrows": []
  },
  {
    "id": "pfc_row_47",
    "opNo": "350",
    "procName": "200% Inspection",
    "incoming": "Wrong master sample",
    "flowchartSymbol": "◇",
    "flowchartType": "inspection",
    "flowchartTrack": 10,
    "charProduct": "Part Selection,Part Missing/ type/ wire color/ Position/ Dimension short / more / Foreign particle/Lock condition,Part Condition",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "",
    "remarks": "IRDCS (Inspection record & defect control system)",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 9,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 9,
        "toTrack": 10
      }
    ],
    "arrows": [
      {
        "track": 9,
        "direction": "left"
      }
    ]
  },
  {
    "id": "pfc_row_48",
    "opNo": "360",
    "procName": "Rework",
    "incoming": "Wrong Tool/Wrong Name Tag",
    "flowchartSymbol": "rework",
    "flowchartType": "rework",
    "flowchartTrack": 9,
    "charProduct": "Part condition,Correct Part,Correct quantity,Appearance,",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "",
    "tools": "Reworking Tool",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 9,
        "from": "top",
        "to": "bottom"
      },
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 9,
        "toTrack": 10
      }
    ],
    "arrows": [
      {
        "track": 9,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_49",
    "opNo": "370",
    "procName": "FG In & Storage",
    "incoming": "",
    "flowchartSymbol": "D",
    "flowchartType": "storage",
    "flowchartTrack": 10,
    "charProduct": "Layout inspection",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "",
    "remarks": "Scanning system",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 9,
        "from": "top",
        "to": "center"
      },
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [
      {
        "fromTrack": 9,
        "toTrack": 10
      }
    ],
    "arrows": [
      {
        "track": 10,
        "direction": "down"
      }
    ]
  },
  {
    "id": "pfc_row_50",
    "opNo": "375",
    "procName": "Layout Inspection",
    "incoming": "",
    "flowchartSymbol": "◇",
    "flowchartType": "inspection",
    "flowchartTrack": 10,
    "charProduct": "Part Quantity,Correct Part,Correct bin card,Correct bin card of MSIL bin Tag,",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "",
    "remarks": "",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 10,
        "from": "top",
        "to": "bottom"
      }
    ],
    "hLines": [],
    "arrows": []
  },
  {
    "id": "pfc_row_51",
    "opNo": "380",
    "procName": "PDI & Dispatch",
    "incoming": "",
    "flowchartSymbol": "▽",
    "flowchartType": "storage",
    "flowchartTrack": 10,
    "charProduct": "",
    "charProcess": "",
    "spCustomer": "",
    "spInternal": "",
    "inspection": "○",
    "tools": "",
    "remarks": "In warehouse",
    "partApplicability": {
      "36630-75U00": "√",
      "36630-75U10": "√",
      "36630-75U20": "√",
      "36630-75U30": "√",
      "36630-75U40": "√",
      "36630-75U50": "√",
      "36630-75U60": "√",
      "36630-75U70": "√",
      "36630-75U80": "√",
      "36630-75U90": "√",
      "36630-75UB0": "√",
      "36630-75UC0": "√",
      "36630-75UD0": "√",
      "36630-75UP0": "√",
      "36603-75U00": "√",
      "36603-75U10": "√",
      "36603-75U20": "√",
      "36603-75U30": "√",
      "36603-75U40": "√",
      "36630-75UF0": "√",
      "36630-75UG0": "√",
      "36630-75UH0": "√"
    },
    "vLines": [
      {
        "track": 10,
        "from": "top",
        "to": "center"
      }
    ],
    "hLines": [],
    "arrows": []
  }
];

export const DEFAULT_PFC_DOCUMENTS = [
  {
    id: 'pfc-yhb-floor-001',
    title: 'Process Flow Chart - HARNESS ASSY FLOOR',
    pfcNo: 'PFC-WH-PE-MSIL-YHB -002',
    code: 'PFC-WH-PE-MSIL-YHB -002',
    customer: 'Maruti Suzuki India Limited',
    unit: 'Bawal',
    partNumber: '36603-75U**/36630-75U**',
    partName: 'HARNESS ASSY FLOOR',
    project: 'YHB/C_RC25',
    status: 'Approved',
    revDate: '11.09.2026',
    updatedAt: '2026-09-11',
    isDefault: true,
    metadata: INITIAL_PFC_METADATA,
    revisionHistory: INITIAL_PFC_REVISION_HISTORY,
    signOff: INITIAL_PFC_SIGN_OFF,
  },
];
