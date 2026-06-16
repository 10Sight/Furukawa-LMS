import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
    useGetEvaluationTestByIdQuery,
    useCreateEvaluationTestMutation,
    useUpdateEvaluationTestMutation
} from "@/Redux/AllApi/EvaluationTestApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
    IconArrowLeft,
    IconTrash,
    IconPlus,
    IconPrinter,
    IconDeviceFloppy,
    IconFolderPlus,
    IconHelp,
    IconLoader2,
    IconLayout2
} from "@tabler/icons-react";

// Default template structure to guide the user on load
const DEFAULT_STRUCTURE = [
    {
        id: "c-1",
        title: "Preparation",
        categories: [
            {
                id: "cat-1",
                title: "Prepare equipment",
                questions: [
                    { id: "q-1", text: "Can he or she prepare the necessary applicator? क्या वह आवश्यक ऐप्लिकेटर तैयार कर सकता है?" },
                    { id: "q-2", text: "Can he or she remove and install the applicator? क्या वह ऐप्लिकेटर को हटा और स्थापित कर सकता है?" }
                ]
            },
            {
                id: "cat-2",
                title: "Prepare material",
                questions: [
                    { id: "q-3", text: "The terminal treatment method is correct Isn't it? टर्मिनल उपचार पद्धति सही है ना?" }
                ]
            }
        ]
    }
];

const normalizeContentStructure = (structure, fallbackTitle) => {
    if (!Array.isArray(structure) || structure.length === 0) {
        return [
            {
                id: `mt-${Date.now()}`,
                title: fallbackTitle || "1. Main Title Section",
                contentSections: []
            }
        ];
    }
    
    const isNewFormat = structure.every(item => item && Array.isArray(item.contentSections));
    
    if (isNewFormat) {
        return structure.map(block => ({
            id: block.id || `mt-${Date.now()}-${Math.random()}`,
            title: block.title || "Main Title Section",
            contentSections: Array.isArray(block.contentSections) ? block.contentSections : []
        }));
    }
    
    return [
        {
            id: "mt-auto-generated",
            title: fallbackTitle || "1. Main Title Section",
            contentSections: structure
        }
    ];
};

const EvaluationTestBuilder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isPrintModeUrl = searchParams.get("mode") === "print";

    const isEditMode = !!id;

    // Local builder states
    const [title, setTitle] = useState("Auto Crimping Operation");
    const [performDateCount, setPerformDateCount] = useState(4);
    const [contentStructure, setContentStructure] = useState(() => normalizeContentStructure(DEFAULT_STRUCTURE, "1. Taping operation"));
    const [isPrintMode, setIsPrintMode] = useState(isPrintModeUrl);
    const [educatorName, setEducatorName] = useState("");

    // RTK Query API Hooks
    const { data: fetchResponse, isLoading: isFetching } = useGetEvaluationTestByIdQuery(id, { skip: !isEditMode });
    const [createEvaluationTest, { isLoading: isCreating }] = useCreateEvaluationTestMutation();
    const [updateEvaluationTest, { isLoading: isUpdating }] = useUpdateEvaluationTestMutation();

    // Populate data when in edit mode
    useEffect(() => {
        if (isEditMode && fetchResponse?.data) {
            const test = fetchResponse.data;
            setTitle(test.title || "");
            setPerformDateCount(test.performDateCount || 4);
            setContentStructure(normalizeContentStructure(test.contentStructure || [], test.title));
        }
    }, [isEditMode, fetchResponse]);

    // Binds shortcut key to close print preview
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isPrintMode && !isPrintModeUrl) {
                setIsPrintMode(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isPrintMode, isPrintModeUrl]);

    // Helper functions to manage the dynamic tree structure
    const addMainTitleBlock = () => {
        const newBlock = {
            id: `mt-${Date.now()}`,
            title: "New Main Title Section",
            contentSections: [
                {
                    id: `c-${Date.now()}`,
                    title: "New Content Section",
                    categories: [
                        {
                            id: `cat-${Date.now()}`,
                            title: "New Category",
                            questions: [{ id: `q-${Date.now()}`, text: "New Question / Checking Item" }]
                        }
                    ]
                }
            ]
        };
        setContentStructure([...contentStructure, newBlock]);
    };

    const deleteMainTitleBlock = (blockId) => {
        setContentStructure(contentStructure.filter(b => b.id !== blockId));
    };

    const updateMainTitleBlockTitle = (blockId, value) => {
        setContentStructure(contentStructure.map(b =>
            b.id === blockId ? { ...b, title: value } : b
        ));
    };

    const addContentBlock = (blockId) => {
        setContentStructure(contentStructure.map(b => {
            if (b.id === blockId) {
                const newBlock = {
                    id: `c-${Date.now()}`,
                    title: "New Content Section",
                    categories: [
                        {
                            id: `cat-${Date.now()}`,
                            title: "New Category",
                            questions: [{ id: `q-${Date.now()}`, text: "New Question / Checking Item" }]
                        }
                    ]
                };
                return { ...b, contentSections: [...(b.contentSections || []), newBlock] };
            }
            return b;
        }));
    };

    const deleteContentBlock = (blockId, contentId) => {
        setContentStructure(contentStructure.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    contentSections: (b.contentSections || []).filter(c => c.id !== contentId)
                };
            }
            return b;
        }));
    };

    const updateContentTitle = (blockId, contentId, value) => {
        setContentStructure(contentStructure.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    contentSections: (b.contentSections || []).map(c =>
                        c.id === contentId ? { ...c, title: value } : c
                    )
                };
            }
            return b;
        }));
    };

    const addCategory = (blockId, contentId) => {
        setContentStructure(contentStructure.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    contentSections: (b.contentSections || []).map(c => {
                        if (c.id === contentId) {
                            const newCat = {
                                id: `cat-${Date.now()}`,
                                title: "New Category",
                                questions: [{ id: `q-${Date.now()}`, text: "New Question" }]
                            };
                            return { ...c, categories: [...(c.categories || []), newCat] };
                        }
                        return c;
                    })
                };
            }
            return b;
        }));
    };

    const deleteCategory = (blockId, contentId, catId) => {
        setContentStructure(contentStructure.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    contentSections: (b.contentSections || []).map(c => {
                        if (c.id === contentId) {
                            return {
                                ...c,
                                categories: (c.categories || []).filter(cat => cat.id !== catId)
                            };
                        }
                        return c;
                    })
                };
            }
            return b;
        }));
    };

    const updateCategoryTitle = (blockId, contentId, catId, value) => {
        setContentStructure(contentStructure.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    contentSections: (b.contentSections || []).map(c => {
                        if (c.id === contentId) {
                            return {
                                ...c,
                                categories: (c.categories || []).map(cat =>
                                    cat.id === catId ? { ...cat, title: value } : cat
                                )
                            };
                        }
                        return c;
                    })
                };
            }
            return b;
        }));
    };

    const addQuestion = (blockId, contentId, catId) => {
        setContentStructure(contentStructure.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    contentSections: (b.contentSections || []).map(c => {
                        if (c.id === contentId) {
                            return {
                                ...c,
                                categories: (c.categories || []).map(cat => {
                                    if (cat.id === catId) {
                                        return {
                                            ...cat,
                                            questions: [...(cat.questions || []), { id: `q-${Date.now()}`, text: "New Question" }]
                                        };
                                    }
                                    return cat;
                                })
                            };
                        }
                        return c;
                    })
                };
            }
            return b;
        }));
    };

    const deleteQuestion = (blockId, contentId, catId, qId) => {
        setContentStructure(contentStructure.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    contentSections: (b.contentSections || []).map(c => {
                        if (c.id === contentId) {
                            return {
                                ...c,
                                categories: (c.categories || []).map(cat => {
                                    if (cat.id === catId) {
                                        return {
                                            ...cat,
                                            questions: (cat.questions || []).filter(q => q.id !== qId)
                                        };
                                    }
                                    return cat;
                                })
                            };
                        }
                        return c;
                    })
                };
            }
            return b;
        }));
    };

    const updateQuestionText = (blockId, contentId, catId, qId, value) => {
        setContentStructure(contentStructure.map(b => {
            if (b.id === blockId) {
                return {
                    ...b,
                    contentSections: (b.contentSections || []).map(c => {
                        if (c.id === contentId) {
                            return {
                                ...c,
                                categories: (c.categories || []).map(cat => {
                                    if (cat.id === catId) {
                                        return {
                                            ...cat,
                                            questions: (cat.questions || []).map(q =>
                                                q.id === qId ? { ...q, text: value } : q
                                            )
                                        };
                                    }
                                    return cat;
                                })
                            };
                        }
                        return c;
                    })
                };
            }
            return b;
        }));
    };

    // Calculate dynamic rows counts for perfect merged grid alignment per Main Title block
    const getRowSpanCalculationsForBlock = (contentSections, startIdx = 1) => {
        let globalIndex = startIdx - 1;
        const rowStructure = [];

        (contentSections || []).forEach((content) => {
            let contentQCount = 0;
            const contentRows = [];

            (content.categories || []).forEach((cat) => {
                const catQCount = (cat.questions || []).length;
                contentQCount += catQCount;

                (cat.questions || []).forEach((q, qIdx) => {
                    globalIndex++;
                    contentRows.push({
                        qId: q.id,
                        qText: q.text,
                        qIndex: globalIndex,
                        catId: cat.id,
                        catTitle: cat.title,
                        catSpan: qIdx === 0 ? catQCount : 0,
                        isFirstInCat: qIdx === 0,
                        contentId: content.id,
                        contentTitle: content.title,
                        isFirstInContent: false // filled later
                    });
                });
            });

            if (contentRows.length > 0) {
                contentRows[0].isFirstInContent = true;
                contentRows[0].contentSpan = contentQCount;
            }

            rowStructure.push(...contentRows);
        });

        return { rowStructure, nextIdx: globalIndex + 1 };
    };

    const precomputedBlocks = React.useMemo(() => {
        return contentStructure.map((block) => {
            const { rowStructure } = getRowSpanCalculationsForBlock(block.contentSections || [], 1);
            return {
                ...block,
                rows: rowStructure
            };
        });
    }, [contentStructure]);

    const handleSave = async () => {
        if (!title.trim()) {
            alert("Please enter a test paper title.");
            return;
        }

        const payload = {
            title,
            performDateCount,
            contentStructure
        };

        try {
            if (isEditMode) {
                await updateEvaluationTest({ id, ...payload }).unwrap();
                alert("Evaluation test template updated successfully!");
            } else {
                await createEvaluationTest(payload).unwrap();
                alert("Evaluation test template created successfully!");
            }
            navigate("/admin/evaluation-test");
        } catch (error) {
            console.error("Failed to save evaluation test", error);
            alert("Error saving evaluation test paper.");
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (isFetching) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-gray-500">
                <IconLoader2 className="animate-spin text-blue-600 h-10 w-10" />
                <span className="text-sm font-medium">Loading evaluation test details...</span>
            </div>
        );
    }

    // High-Fidelity Spreadsheet Sheet Layout JSX
    const renderSpreadsheetTable = () => {
        return (
            <div className="bg-white text-black p-6 font-sans border-2 border-black rounded-lg shadow-sm print:border-0 print:p-0 print:shadow-none w-full select-none overflow-x-auto">
                {/* Print Styles overrides to ensure fit */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .print-sheet-area, .print-sheet-area * {
                            visibility: visible;
                        }
                        .print-sheet-area {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100% !important;
                            padding: 0 !important;
                            margin: 0 !important;
                            border: 0 !important;
                        }
                        table {
                            width: 100% !important;
                            border-collapse: collapse !important;
                        }
                        th, td {
                            border: 1px solid black !important;
                            padding: 4px 6px !important;
                            font-size: 10px !important;
                        }
                    }
                `}} />

                <div className="print-sheet-area w-full max-w-full space-y-4">
                    {/* Top metadata tags */}
                    <div className="flex justify-between items-start text-xs border-b border-black pb-2">
                        <div className="flex flex-col items-start gap-1">
                            <img src="/fme_transparent.png" alt="FME Logo" className="h-8 w-auto object-contain" />
                            <div className="font-semibold text-[10px] sm:text-xs">FURUKAWA ELECTRICAL INDIA PVT. LTD.</div>
                        </div>
                        <div className="text-right text-[10px] sm:text-xs leading-tight font-mono">
                            <div>ST-S16-01 FORMAT 4 -E</div>
                            <div>Revision No. 01</div>
                            <div>Revision Date : 28.02.2025</div>
                            <div>Issue date : 17.01.2024</div>
                        </div>
                    </div>

                    {/* Sheet Main Header */}
                    <div className="flex flex-col md:flex-row justify-between gap-4 border border-black p-4 bg-gray-50/50">
                        <div className="flex-1 flex items-center">
                            <h2 className="text-sm sm:text-lg font-bold uppercase tracking-tight text-gray-800 leading-tight">
                                DOJO Evaluation test of practical education 【Former process】
                            </h2>
                        </div>
                        <div className="grid grid-cols-3 border border-black text-center text-[10px] sm:text-xs w-full md:w-72 h-14 font-semibold">
                            <div className="border-r border-black flex flex-col">
                                <span className="border-b border-black py-0.5 bg-gray-100 text-[9px] uppercase">Approved</span>
                                <span className="flex-1"></span>
                            </div>
                            <div className="border-r border-black flex flex-col">
                                <span className="border-b border-black py-0.5 bg-gray-100 text-[9px] uppercase">Confirmed</span>
                                <span className="flex-1"></span>
                            </div>
                            <div className="flex flex-col">
                                <span className="border-b border-black py-0.5 bg-gray-100 text-[9px] uppercase">Planned</span>
                                <div className="flex-1 flex items-center justify-center bg-white font-extrabold text-blue-700 text-[10px] p-1 truncate">
                                    {educatorName || "-"}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* High-Fidelity Table Grid */}
                    <table className="w-full text-left text-xs border border-black border-collapse">
                        <thead>
                            {/* Unified Trainee Details Box inside the Table Grid for absolute pixel-perfect column alignment */}
                            <tr className="border-x border-b border-black text-xs font-semibold text-left">
                                <td className="border border-black bg-gray-100 p-2 text-[10px] uppercase font-bold align-middle" colSpan={1}>Trainee</td>
                                <td className="border border-black p-2 bg-white" colSpan={3}></td>
                                <td className="border border-black p-2 bg-white" colSpan={performDateCount + 1}></td>
                            </tr>
                            <tr className="border-x border-b border-black text-xs font-semibold text-left">
                                <td className="border border-black bg-gray-100 p-2 text-[10px] uppercase font-bold align-middle" colSpan={1}>Employee No.</td>
                                <td className="border border-black p-2 bg-white" colSpan={3}></td>
                                <td className="border border-black p-2 bg-white" colSpan={performDateCount + 1}></td>
                            </tr>
                            <tr className="border-x border-b border-black text-xs font-semibold text-left">
                                <td className="border border-black bg-gray-100 p-2 text-[10px] uppercase font-bold leading-tight align-middle" colSpan={1}>Education giving person</td>
                                <td className="border border-black p-2 bg-white" colSpan={3}>
                                    <input
                                        type="text"
                                        placeholder="Enter Educator Name..."
                                        value={educatorName}
                                        onChange={(e) => setEducatorName(e.target.value)}
                                        className="w-full px-1 border-0 focus:ring-0 focus:outline-none bg-transparent font-semibold text-gray-800 text-xs"
                                    />
                                </td>
                                <td className="border border-black p-2 bg-white" colSpan={performDateCount + 1}></td>
                            </tr>
                        </thead>
                        <tbody>
                            {precomputedBlocks.length === 0 ? (
                                <tr>
                                    <td colSpan={5 + performDateCount} className="p-8 text-center text-gray-400 italic">
                                        No checking items added yet. Build the structure in the form panel.
                                    </td>
                                </tr>
                            ) : (
                                precomputedBlocks.map((block, blockIdx) => (
                                    <React.Fragment key={block.id}>
                                        {/* Dynamic Title Indicator row (Main Title Section) */}
                                        <tr className="bg-blue-50/20 font-bold border border-black text-xs sm:text-sm uppercase text-left">
                                            <td className="p-3 border border-black font-extrabold text-blue-700 text-center" colSpan={1}>
                                                {blockIdx + 1}.
                                            </td>
                                            <td className="p-3 border border-black bg-white" colSpan={performDateCount + 4}>
                                                {block.title || "Dynamic Test Paper Title"}
                                            </td>
                                        </tr>

                                        {/* Sub-Header Rows for this Block */}
                                        <tr className="bg-gray-100 border-b border-black font-bold text-center text-[10px] sm:text-xs">
                                            <th className="border-r border-black p-2 w-[12%] text-center align-middle" rowSpan={3}>Content</th>
                                            <th className="border-r border-black p-2 w-[42%] text-center align-middle" colSpan={3} rowSpan={3}>Checking items</th>
                                            {Array.from({ length: performDateCount }).map((_, idx) => (
                                                <th
                                                    key={idx}
                                                    className="border-r border-black p-1 text-[8.5px] font-bold text-center leading-normal align-middle bg-white w-12 font-sans text-black"
                                                    rowSpan={1}
                                                >
                                                    {idx === 0 ? "Process introduction & Process Specific" : "Process Specific"}
                                                </th>
                                            ))}
                                            <th className="p-2 w-[15%] text-center uppercase tracking-wider align-middle" rowSpan={3}>Comment</th>
                                        </tr>
                                        <tr className="bg-gray-100 border-b border-black font-bold text-center text-[10px] sm:text-xs">
                                            <th className="border-r border-black p-2 text-center align-middle font-bold uppercase tracking-wider text-[11px]" colSpan={performDateCount} rowSpan={1}>
                                                Evaluation result
                                            </th>
                                        </tr>
                                        <tr className="bg-gray-50/50 border-b border-black font-semibold text-[9px] text-center">
                                            {Array.from({ length: performDateCount }).map((_, idx) => (
                                                <th key={idx} className="border-r border-black p-1 text-[8.5px] font-bold whitespace-nowrap leading-none align-middle">
                                                    <div className="border-b border-gray-200 pb-0.5 mb-0.5">{idx + 1}</div>
                                                    <div>Perform date</div>
                                                </th>
                                            ))}
                                        </tr>

                                        {/* Question Rows for this Block */}
                                        {block.rows.length === 0 ? (
                                            <tr>
                                                <td colSpan={5 + performDateCount} className="p-6 text-center text-gray-400 italic">
                                                    No questions added under this title section.
                                                </td>
                                            </tr>
                                        ) : (
                                            block.rows.map((row, idx) => (
                                                <tr key={row.qId} className="border-b border-black hover:bg-gray-50/40 transition-colors">
                                                    {/* Content Column Cell (Merged) */}
                                                    {row.isFirstInContent && (
                                                        <td
                                                            rowSpan={row.contentSpan}
                                                            className="border-r border-black p-2 font-bold text-center align-middle uppercase text-gray-800 bg-gray-50/20 text-[10px] break-words whitespace-normal leading-normal"
                                                        >
                                                            {row.contentTitle}
                                                        </td>
                                                    )}

                                                    {/* Category Column Cell (Merged) - Omitted if category title is blank */}
                                                    {row.isFirstInCat && row.catTitle?.trim() && (
                                                        <td
                                                            rowSpan={row.catSpan}
                                                            className="border-r border-black p-2 font-semibold text-center align-middle text-gray-700 text-[10px] break-words whitespace-normal leading-normal bg-gray-50/10"
                                                        >
                                                            {row.catTitle}
                                                        </td>
                                                    )}

                                                    {/* Checking Question Number Cell */}
                                                    <td className="border-r border-black p-2 text-center align-middle font-bold text-blue-700 bg-gray-50/5 text-[10.5px] w-8 shrink-0">
                                                        {row.qIndex}
                                                    </td>

                                                    {/* Checking Question Description Cell - Spans 2 columns if category is blank */}
                                                    <td 
                                                        colSpan={!row.catTitle?.trim() ? 2 : 1}
                                                        className="border-r border-black p-2.5 align-middle leading-relaxed text-[10.5px] text-gray-900 font-medium whitespace-pre-line"
                                                    >
                                                        {row.qText}
                                                    </td>

                                                    {/* Evaluation Columns Cells */}
                                                    {Array.from({ length: performDateCount }).map((_, colIdx) => (
                                                        <td key={colIdx} className="border-r border-black p-2 text-center align-middle w-12 h-10"></td>
                                                    ))}

                                                    {/* Comment Column Cell */}
                                                    <td className="p-2 align-middle text-center w-[15%]"></td>
                                                </tr>
                                            ))
                                        )}

                                        {/* Evaluation footer statement for this Block */}
                                        <tr className="border-t border-b-2 border-black font-semibold text-xs bg-gray-50/50">
                                            <td colSpan={3} className="border-r border-black p-3 font-bold text-center uppercase tracking-wider align-middle bg-gray-100">
                                                Evaluation
                                            </td>
                                            <td colSpan={2 + performDateCount} className="p-3 text-orange-600 font-bold text-center tracking-normal leading-relaxed text-[11px] sm:text-xs">
                                                30 minutes daily session discussion (Question / Answer) hearing from employee
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // Render Print-Only full width view
    if (isPrintMode) {
        return (
            <div className="space-y-6 w-full max-w-full print:p-0">
                {/* Print Controls overlay */}
                <div className="flex justify-between items-center gap-4 bg-gray-900 text-white p-4 rounded-xl shadow-lg border border-gray-800 print:hidden">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                if (isPrintModeUrl) navigate("/admin/evaluation-test");
                                else setIsPrintMode(false);
                            }}
                            className="hover:bg-gray-800 text-white hover:text-white"
                        >
                            <IconArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <span className="font-bold text-sm sm:text-base">Print Preview Mode</span>
                            <p className="text-gray-400 text-xs hidden sm:block">Press ESC or click the back arrow to exit preview and return to builder</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            onClick={handlePrint}
                            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 font-medium"
                        >
                            <IconPrinter className="h-4.5 w-4.5" />
                            Print Sheet (Ctrl+P)
                        </Button>
                        {!isPrintModeUrl && (
                            <Button
                                variant="outline"
                                onClick={() => setIsPrintMode(false)}
                                className="border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
                            >
                                Back to Builder
                            </Button>
                        )}
                    </div>
                </div>

                <div className="w-full">
                    {renderSpreadsheetTable()}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
                <div className="flex items-start gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate("/admin/evaluation-test")}
                        className="h-9 w-9 border-gray-200 text-gray-600 hover:text-gray-800"
                    >
                        <IconArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                            <IconLayout2 className="text-blue-600 h-7 w-7" />
                            {isEditMode ? "Edit DOJO Evaluation Test" : "Create DOJO Evaluation Test"}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Build dynamic DOJO evaluation test structures with nested categories, questions, and auto-generated sheet row spans.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setIsPrintMode(true)}
                        className="border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2 font-semibold shadow-sm"
                    >
                        <IconPrinter className="h-4 w-4" />
                        Print Preview
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isCreating || isUpdating}
                        className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 font-semibold shadow-md shadow-blue-200"
                    >
                        {isCreating || isUpdating ? (
                            <IconLoader2 className="h-4.5 w-4.5 animate-spin" />
                        ) : (
                            <IconDeviceFloppy className="h-4.5 w-4.5" />
                        )}
                        {isEditMode ? "Save Changes" : "Create Template"}
                    </Button>
                </div>
            </div>

            {/* 1. Top Section: Form Builder Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                {/* Form Configuration Card (Left Column) */}
                <div className="lg:col-span-4 space-y-6">
                    <Card className="border border-gray-150 shadow-sm rounded-xl">
                        <CardHeader className="bg-gray-50/60 rounded-t-xl border-b border-gray-100">
                            <CardTitle className="text-base font-semibold text-gray-800">Form Configuration</CardTitle>
                            <CardDescription>Setup overall test paper details and perform date counts.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            {/* Title Field */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Test Paper Overall Name</label>
                                <Input
                                    type="text"
                                    placeholder="e.g. DOJO Evaluation test of practical education"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="border-gray-200 focus:ring-blue-100"
                                />
                                <p className="text-[10px] text-gray-400">The overall identifier of this DOJO evaluation sheet.</p>
                            </div>

                            {/* Perform Date Columns Count Field */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-700 uppercase tracking-wide">Evaluation Result (Perform Date) Count</label>
                                <Input
                                    type="number"
                                    min="1"
                                    max="6"
                                    value={performDateCount}
                                    onChange={(e) => setPerformDateCount(Math.min(6, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                                    className="border-gray-200 focus:ring-blue-100 w-full"
                                />
                                <p className="text-[10px] text-gray-400">Determines the number of evaluation outcome columns rendered (maximum 6).</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Checking List Tree Structure Builder Card (Right Column) */}
                <div className="lg:col-span-8">
                    <Card className="border border-gray-150 shadow-sm rounded-xl">
                        <CardHeader className="bg-gray-50/60 rounded-t-xl border-b border-gray-100 flex flex-row items-center justify-between py-4">
                            <div>
                                <CardTitle className="text-base font-semibold text-gray-800">Checking Structure Builder</CardTitle>
                                <CardDescription>Arrange Main Title sections, Content headers, sub-categories, and questions.</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={addMainTitleBlock}
                                className="border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-bold flex items-center gap-1.5"
                            >
                                <IconPlus className="h-3.5 w-3.5" />
                                Add Main Title Section
                            </Button>
                        </CardHeader>
                        <CardContent className="p-5 space-y-6 overflow-y-auto max-h-[600px] scrollbar-thin">
                            {contentStructure.map((block, bIdx) => (
                                <div key={block.id} className="border border-gray-200 rounded-xl p-5 bg-white space-y-4 shadow-sm relative group mb-6">
                                    {/* Main Title Block Header */}
                                    <div className="flex items-center justify-between gap-3 border-b border-gray-150 pb-3">
                                        <div className="flex-1 space-y-1">
                                            <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                Main Title Section {bIdx + 1}
                                            </span>
                                            <Input
                                                type="text"
                                                placeholder="Main Title Section (e.g. 1. Taping operation)"
                                                value={block.title}
                                                onChange={(e) => updateMainTitleBlockTitle(block.id, e.target.value)}
                                                className="border-gray-200 font-extrabold text-base focus:ring-blue-100 bg-blue-50/10"
                                            />
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => deleteMainTitleBlock(block.id)}
                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 self-end"
                                            title="Delete Main Title Section"
                                        >
                                            <IconTrash className="h-4.5 w-4.5" />
                                        </Button>
                                    </div>

                                    {/* Content Sections inside this Main Title Block */}
                                    <div className="pl-4 border-l-2 border-blue-300 space-y-4">
                                        {(block.contentSections || []).map((content, cIdx) => (
                                            <div key={content.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50/40 space-y-4 shadow-xs relative group/c">
                                                {/* Content Section Header */}
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="flex-1 space-y-1">
                                                        <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                            Content Section {cIdx + 1}
                                                        </span>
                                                        <Input
                                                            type="text"
                                                            placeholder="Content Section Title (e.g. Daily checking)"
                                                            value={content.title}
                                                            onChange={(e) => updateContentTitle(block.id, content.id, e.target.value)}
                                                            className="border-gray-200 font-bold bg-white text-sm focus:ring-blue-100"
                                                        />
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => deleteContentBlock(block.id, content.id)}
                                                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 self-end"
                                                        title="Delete Content Section"
                                                    >
                                                        <IconTrash className="h-4.5 w-4.5" />
                                                    </Button>
                                                </div>

                                                {/* Categories under Content Section */}
                                                <div className="pl-4 border-l-2 border-indigo-250 space-y-4">
                                                    {(content.categories || []).map((cat, catIdx) => (
                                                        <div key={cat.id} className="border border-gray-150 rounded-lg p-3 bg-white space-y-3 relative">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex-1 space-y-1">
                                                                    <span className="text-[9px] font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                                        Category {catIdx + 1}
                                                                    </span>
                                                                    <Input
                                                                        type="text"
                                                                        placeholder="Category Name (e.g. ASSY DRAWING)"
                                                                        value={cat.title}
                                                                        onChange={(e) => updateCategoryTitle(block.id, content.id, cat.id, e.target.value)}
                                                                        className="border-gray-200 font-semibold bg-white text-xs py-1 h-8 focus:ring-teal-100"
                                                                    />
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => deleteCategory(block.id, content.id, cat.id)}
                                                                    className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 self-end"
                                                                    title="Delete Category"
                                                                >
                                                                    <IconTrash className="h-4 w-4" />
                                                                </Button>
                                                            </div>

                                                            {/* Questions List */}
                                                            <div className="pl-3 border-l border-teal-200 space-y-2">
                                                                <span className="text-[8px] font-extrabold text-gray-400 uppercase tracking-widest block">Checking Questions</span>
                                                                {(cat.questions || []).map((q, qIdx) => (
                                                                    <div key={q.id} className="flex gap-2 items-start group/q">
                                                                        <div className="flex-1 flex gap-2 items-center">
                                                                            <span className="text-[10px] font-bold text-gray-400 bg-gray-50 h-6 w-6 rounded-full flex items-center justify-center border border-gray-100 shrink-0">
                                                                                {qIdx + 1}
                                                                            </span>
                                                                            <Input
                                                                                type="text"
                                                                                placeholder="e.g. Can he prepare applicator? क्या वह..."
                                                                                value={q.text}
                                                                                onChange={(e) => updateQuestionText(block.id, content.id, cat.id, q.id, e.target.value)}
                                                                                className="border-gray-200 text-xs py-1 h-8 focus:ring-gray-100 bg-white"
                                                                            />
                                                                        </div>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() => deleteQuestion(block.id, content.id, cat.id, q.id)}
                                                                            className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover/q:opacity-100 transition-opacity"
                                                                            title="Delete Question"
                                                                        >
                                                                            <IconTrash className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => addQuestion(block.id, content.id, cat.id)}
                                                                    className="text-[10px] font-bold text-teal-600 hover:text-teal-700 hover:bg-teal-50/70 p-1 h-6 flex items-center gap-1 mt-1"
                                                                >
                                                                    <IconPlus className="h-3.5 w-3.5" />
                                                                    Add Question
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => addCategory(block.id, content.id)}
                                                        className="text-xs font-bold text-teal-600 hover:text-teal-700 hover:bg-teal-50/70 py-1 px-2 h-7 flex items-center gap-1"
                                                    >
                                                        <IconPlus className="h-3.5 w-3.5" />
                                                        Add Category
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}

                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => addContentBlock(block.id)}
                                            className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50/70 py-1 px-2 h-7 flex items-center gap-1"
                                        >
                                            <IconPlus className="h-3.5 w-3.5" />
                                            Add Content Section
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

            </div>

            {/* 2. Bottom Section: Full Width Live Spreadsheet Preview */}
            <div className="space-y-4 pt-6 border-t border-gray-100">
                <div className="flex items-center justify-between border-b border-gray-150 pb-2">
                    <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5 uppercase tracking-wide">
                        Live Spreadsheet Preview
                    </span>
                    <span className="text-[10px] text-gray-400 bg-gray-50 border border-gray-150 px-2 py-0.5 rounded-full font-mono font-medium">
                        Auto-syncs on edits
                    </span>
                </div>

                <div className="w-full overflow-x-auto bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="min-w-[1150px]">
                        {renderSpreadsheetTable()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EvaluationTestBuilder;
