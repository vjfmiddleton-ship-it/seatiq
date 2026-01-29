"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Slider } from "@/components/ui/slider";
import { cn, formatScore } from "@/lib/utils";
import { generateSeatingPDF, type ExportData } from "@/components/pdf-export";

interface Guest {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  department: string | null;
  jobTitle: string | null;
  seniority: string | null;
  guestType: string;
  notes: string | null;
  tags: string[];
  needsReview: boolean;
}

interface Constraint {
  id: string;
  type: string;
  guestIds: string[];
  value: number | null;
  notes: string | null;
}

interface Objectives {
  noveltyWeight: number;
  diversityWeight: number;
  balanceWeight: number;
  transactionWeight: number;
}

interface Plan {
  id: string;
  version: number;
  status: string;
  assignments: Record<string, string[]>;
  metrics: {
    novelty: number;
    diversity: number;
    balance: number;
    transaction: number;
    weighted: number;
  };
  explanations: {
    perTable: Record<string, string[]>;
    overall: string;
  };
  createdAt: string;
}

interface Event {
  id: string;
  name: string;
  date: string | null;
  venue: string | null;
  description: string | null;
  tableCount: number;
  seatsPerTable: number;
  guests: Guest[];
  constraints: Constraint[];
  objectives: Objectives | null;
  plans: Plan[];
}

type Tab = "guests" | "constraints" | "objectives" | "seating";

export default function EventPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const eventId = params.eventId as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("guests");
  const [optimizing, setOptimizing] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [exporting, setExporting] = useState(false);

  // Guest state
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [csvText, setCsvText] = useState("");
  const [importing, setImporting] = useState(false);

  // Constraint state
  const [showConstraintModal, setShowConstraintModal] = useState(false);
  const [newConstraint, setNewConstraint] = useState({
    type: "MUST_SIT_TOGETHER",
    guestIds: [] as string[],
    value: 2,
  });

  // Objectives state
  const [objectives, setObjectives] = useState<Objectives>({
    noveltyWeight: 0.25,
    diversityWeight: 0.25,
    balanceWeight: 0.25,
    transactionWeight: 0.25,
  });

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  const fetchEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setEvent(data);
        if (data.objectives) {
          setObjectives(data.objectives);
        }
        if (data.plans && data.plans.length > 0) {
          setCurrentPlan(data.plans[0]);
        }
      } else if (res.status === 404) {
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Failed to fetch event:", error);
    } finally {
      setLoading(false);
    }
  }, [eventId, router]);

  useEffect(() => {
    if (session && eventId) {
      fetchEvent();
    }
  }, [session, eventId, fetchEvent]);

  const handleAddGuest = async (guestData: Partial<Guest>) => {
    try {
      const res = await fetch(`/api/events/${eventId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guestData),
      });
      if (res.ok) {
        fetchEvent();
        setShowGuestModal(false);
        setEditingGuest(null);
      }
    } catch (error) {
      console.error("Failed to add guest:", error);
    }
  };

  const handleUpdateGuest = async (guestId: string, guestData: Partial<Guest>) => {
    try {
      const res = await fetch(`/api/events/${eventId}/guests/${guestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(guestData),
      });
      if (res.ok) {
        fetchEvent();
        setEditingGuest(null);
      }
    } catch (error) {
      console.error("Failed to update guest:", error);
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    if (!confirm("Are you sure you want to delete this guest?")) return;
    try {
      const res = await fetch(`/api/events/${eventId}/guests/${guestId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchEvent();
      }
    } catch (error) {
      console.error("Failed to delete guest:", error);
    }
  };

  const handleImportCSV = async () => {
    setImporting(true);
    try {
      // Parse CSV
      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        alert("CSV must have a header row and at least one data row");
        return;
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const guests = [];

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const guest: Record<string, string | null> = {};

        headers.forEach((header, index) => {
          const value = values[index]?.trim() || "";
          if (header === "name") guest.name = value;
          else if (header === "email") guest.email = value;
          else if (header === "company" || header === "organization") guest.company = value;
          else if (header === "department" || header === "dept") guest.department = value;
          else if (header === "title" || header === "job title" || header === "jobtitle" || header === "role") guest.jobTitle = value;
          else if (header === "seniority" || header === "level") guest.seniority = mapSeniority(value);
          else if (header === "type" || header === "guest type" || header === "guesttype") guest.guestType = mapGuestType(value);
          else if (header === "notes") guest.notes = value;
        });

        if (guest.name) {
          guests.push({
            name: guest.name,
            email: guest.email || null,
            company: guest.company || null,
            department: guest.department || null,
            jobTitle: guest.jobTitle || null,
            seniority: guest.seniority || null,
            guestType: guest.guestType || "NEUTRAL",
            notes: guest.notes || null,
            tags: [],
          });
        }
      }

      if (guests.length === 0) {
        alert("No valid guests found in CSV");
        return;
      }

      const res = await fetch(`/api/events/${eventId}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests }),
      });

      if (res.ok) {
        const result = await res.json();
        alert(`Successfully imported ${result.count} guests`);
        setShowImportModal(false);
        setCsvText("");
        fetchEvent();
      }
    } catch (error) {
      console.error("Failed to import:", error);
      alert("Failed to import guests");
    } finally {
      setImporting(false);
    }
  };

  const handleAddConstraint = async () => {
    if (newConstraint.guestIds.length < 2) {
      alert("Please select at least 2 guests");
      return;
    }

    try {
      const res = await fetch(`/api/events/${eventId}/constraints`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConstraint),
      });
      if (res.ok) {
        fetchEvent();
        setShowConstraintModal(false);
        setNewConstraint({ type: "MUST_SIT_TOGETHER", guestIds: [], value: 2 });
      }
    } catch (error) {
      console.error("Failed to add constraint:", error);
    }
  };

  const handleDeleteConstraint = async (constraintId: string) => {
    try {
      await fetch(`/api/events/${eventId}/constraints/${constraintId}`, {
        method: "DELETE",
      });
      fetchEvent();
    } catch (error) {
      console.error("Failed to delete constraint:", error);
    }
  };

  const handleUpdateObjectives = async () => {
    try {
      await fetch(`/api/events/${eventId}/objectives`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(objectives),
      });
      fetchEvent();
    } catch (error) {
      console.error("Failed to update objectives:", error);
    }
  };

  const handleOptimize = async () => {
    setOptimizing(true);
    try {
      const res = await fetch(`/api/events/${eventId}/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        setCurrentPlan(data.plan);
        setActiveTab("seating");
        fetchEvent();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to optimize seating");
      }
    } catch (error) {
      console.error("Failed to optimize:", error);
      alert("Failed to optimize seating");
    } finally {
      setOptimizing(false);
    }
  };

  const handleExportPDF = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/events/${eventId}/export`);
      if (res.ok) {
        const data: ExportData = await res.json();
        await generateSeatingPDF(data);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to export");
      }
    } catch (error) {
      console.error("Failed to export:", error);
      alert("Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      </div>
    );
  }

  if (!event) return null;

  const tabs = [
    { id: "guests" as Tab, label: "Guests", count: event.guests.length },
    { id: "constraints" as Tab, label: "Constraints", count: event.constraints.length },
    { id: "objectives" as Tab, label: "Objectives" },
    { id: "seating" as Tab, label: "Seating Plan", count: event.plans.length },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
              <p className="text-gray-600 mt-1">
                {event.tableCount} tables × {event.seatsPerTable} seats = {event.tableCount * event.seatsPerTable} total capacity
              </p>
            </div>
            <Button onClick={handleOptimize} loading={optimizing} disabled={event.guests.length === 0}>
              Generate Seating Plan
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap",
                  activeTab === tab.id
                    ? "border-primary-600 text-primary-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-2 bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Guests Tab */}
        {activeTab === "guests" && (
          <div>
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold">Guest List</h2>
              <div className="space-x-2">
                <Button variant="outline" onClick={() => setShowImportModal(true)}>
                  Import CSV
                </Button>
                <Button onClick={() => setShowGuestModal(true)}>Add Guest</Button>
              </div>
            </div>

            {event.guests.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-gray-500 mb-4">No guests added yet</p>
                  <div className="space-x-2">
                    <Button variant="outline" onClick={() => setShowImportModal(true)}>
                      Import CSV
                    </Button>
                    <Button onClick={() => setShowGuestModal(true)}>Add Guest</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seniority</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {event.guests.map((guest) => (
                        <tr key={guest.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">{guest.name}</div>
                            <div className="text-sm text-gray-500">{guest.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {guest.company || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {guest.department || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={cn(
                              "px-2 py-1 text-xs font-medium rounded-full",
                              guest.guestType === "BUYER" && "bg-green-100 text-green-800",
                              guest.guestType === "SELLER" && "bg-blue-100 text-blue-800",
                              guest.guestType === "CATALYST" && "bg-purple-100 text-purple-800",
                              guest.guestType === "NEUTRAL" && "bg-gray-100 text-gray-800"
                            )}>
                              {guest.guestType}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {guest.seniority || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <button
                              onClick={() => setEditingGuest(guest)}
                              className="text-primary-600 hover:text-primary-900 mr-3"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteGuest(guest.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Constraints Tab */}
        {activeTab === "constraints" && (
          <div>
            <div className="flex justify-between mb-4">
              <h2 className="text-lg font-semibold">Seating Constraints</h2>
              <Button onClick={() => setShowConstraintModal(true)} disabled={event.guests.length < 2}>
                Add Constraint
              </Button>
            </div>

            {event.constraints.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-gray-500 mb-4">No constraints defined</p>
                  <p className="text-sm text-gray-400 mb-4">
                    Add constraints to specify who must sit together or apart
                  </p>
                  <Button onClick={() => setShowConstraintModal(true)} disabled={event.guests.length < 2}>
                    Add Constraint
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {event.constraints.map((constraint) => (
                  <Card key={constraint.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className={cn(
                            "px-2 py-1 text-xs font-medium rounded-full mr-3",
                            constraint.type === "MUST_SIT_TOGETHER" && "bg-green-100 text-green-800",
                            constraint.type === "MUST_NOT_SIT_TOGETHER" && "bg-red-100 text-red-800",
                            constraint.type === "MAX_SELLERS_PER_TABLE" && "bg-blue-100 text-blue-800",
                            constraint.type === "MIN_BUYERS_PER_TABLE" && "bg-purple-100 text-purple-800"
                          )}>
                            {constraint.type.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm text-gray-600">
                            {constraint.guestIds.map((id) => {
                              const guest = event.guests.find((g) => g.id === id);
                              return guest?.name;
                            }).filter(Boolean).join(", ")}
                          </span>
                          {constraint.value && (
                            <span className="ml-2 text-sm text-gray-500">(Value: {constraint.value})</span>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteConstraint(constraint.id)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Objectives Tab */}
        {activeTab === "objectives" && (
          <div>
            <Card>
              <CardHeader>
                <CardTitle>Optimization Objectives</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Adjust the weights to prioritize different optimization goals. Weights must sum to 100%.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <Slider
                  id="novelty"
                  label="A) New Connections"
                  min={0}
                  max={1}
                  step={0.05}
                  value={objectives.noveltyWeight}
                  onChange={(e) => setObjectives({ ...objectives, noveltyWeight: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-gray-500 -mt-4">
                  Maximize opportunities for guests to meet new people outside their usual circles
                </p>

                <Slider
                  id="diversity"
                  label="B) Cross-Department Interaction"
                  min={0}
                  max={1}
                  step={0.05}
                  value={objectives.diversityWeight}
                  onChange={(e) => setObjectives({ ...objectives, diversityWeight: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-gray-500 -mt-4">
                  Encourage interaction across departments, companies, and industries
                </p>

                <Slider
                  id="balance"
                  label="C) Balanced Tables"
                  min={0}
                  max={1}
                  step={0.05}
                  value={objectives.balanceWeight}
                  onChange={(e) => setObjectives({ ...objectives, balanceWeight: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-gray-500 -mt-4">
                  Create balanced conversations with diverse seniority and expertise
                </p>

                <Slider
                  id="transaction"
                  label="D) Business Opportunities"
                  min={0}
                  max={1}
                  step={0.05}
                  value={objectives.transactionWeight}
                  onChange={(e) => setObjectives({ ...objectives, transactionWeight: parseFloat(e.target.value) })}
                />
                <p className="text-xs text-gray-500 -mt-4">
                  Optimize for sales opportunities and strategic partnerships
                </p>

                <div className="pt-4 border-t">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-medium">Total Weight:</span>
                    <span className={cn(
                      "font-bold",
                      Math.abs((objectives.noveltyWeight + objectives.diversityWeight + objectives.balanceWeight + objectives.transactionWeight) - 1) < 0.01
                        ? "text-green-600"
                        : "text-red-600"
                    )}>
                      {formatScore(objectives.noveltyWeight + objectives.diversityWeight + objectives.balanceWeight + objectives.transactionWeight)}
                    </span>
                  </div>
                  <Button onClick={handleUpdateObjectives} className="w-full">
                    Save Objectives
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Seating Tab */}
        {activeTab === "seating" && (
          <div>
            {!currentPlan ? (
              <Card className="text-center py-12">
                <CardContent>
                  <p className="text-gray-500 mb-4">No seating plan generated yet</p>
                  <Button onClick={handleOptimize} loading={optimizing} disabled={event.guests.length === 0}>
                    Generate Seating Plan
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Plan Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-primary-600">
                          {formatScore(currentPlan.metrics.weighted)}
                        </div>
                        <div className="text-xs text-gray-500">Overall Score</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-semibold text-gray-700">
                          {formatScore(currentPlan.metrics.novelty)}
                        </div>
                        <div className="text-xs text-gray-500">New Connections</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-semibold text-gray-700">
                          {formatScore(currentPlan.metrics.diversity)}
                        </div>
                        <div className="text-xs text-gray-500">Diversity</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-semibold text-gray-700">
                          {formatScore(currentPlan.metrics.balance)}
                        </div>
                        <div className="text-xs text-gray-500">Balance</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-semibold text-gray-700">
                          {formatScore(currentPlan.metrics.transaction)}
                        </div>
                        <div className="text-xs text-gray-500">Business</div>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-gray-600 text-center">
                      {currentPlan.explanations.overall}
                    </p>
                  </CardContent>
                </Card>

                {/* Tables */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(currentPlan.assignments).map(([tableId, guestIds]) => (
                    <Card key={tableId}>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base flex justify-between">
                          <span>{tableId.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                          <span className="text-sm font-normal text-gray-500">
                            {guestIds.length}/{event.seatsPerTable} seats
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-3">
                        <ul className="space-y-1">
                          {guestIds.map((guestId) => {
                            const guest = event.guests.find((g) => g.id === guestId);
                            if (!guest) return null;
                            return (
                              <li key={guestId} className="text-sm flex items-center justify-between">
                                <span>{guest.name}</span>
                                <span className={cn(
                                  "text-xs px-1.5 py-0.5 rounded",
                                  guest.guestType === "BUYER" && "bg-green-100 text-green-700",
                                  guest.guestType === "SELLER" && "bg-blue-100 text-blue-700",
                                  guest.guestType === "CATALYST" && "bg-purple-100 text-purple-700",
                                  guest.guestType === "NEUTRAL" && "bg-gray-100 text-gray-700"
                                )}>
                                  {guest.company || guest.guestType}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                        {currentPlan.explanations.perTable[tableId] && (
                          <div className="mt-3 pt-3 border-t text-xs text-gray-500">
                            {currentPlan.explanations.perTable[tableId].map((exp, i) => (
                              <p key={i}>• {exp}</p>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-center space-x-4">
                  <Button onClick={handleOptimize} loading={optimizing} variant="outline">
                    Regenerate Plan
                  </Button>
                  <Button onClick={handleExportPDF} loading={exporting}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export PDF
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Add/Edit Guest Modal */}
      <Modal
        isOpen={showGuestModal || editingGuest !== null}
        onClose={() => { setShowGuestModal(false); setEditingGuest(null); }}
        title={editingGuest ? "Edit Guest" : "Add Guest"}
      >
        <GuestForm
          guest={editingGuest}
          onSubmit={(data) => {
            if (editingGuest) {
              handleUpdateGuest(editingGuest.id, data);
            } else {
              handleAddGuest(data);
            }
          }}
          onCancel={() => { setShowGuestModal(false); setEditingGuest(null); }}
        />
      </Modal>

      {/* Import CSV Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Guests from CSV"
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Paste your CSV data below. Expected columns: name, email, company, department, title, seniority, type, notes
          </p>
          <textarea
            className="w-full h-64 p-3 border rounded-lg text-sm font-mono"
            placeholder="name,email,company,department,title,seniority,type,notes
John Doe,john@acme.com,Acme Inc,Sales,VP Sales,Senior,Seller,
Jane Smith,jane@techco.com,TechCo,Engineering,CTO,Executive,Buyer,"
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
          />
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={() => setShowImportModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportCSV} loading={importing} disabled={!csvText.trim()}>
              Import
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Constraint Modal */}
      <Modal
        isOpen={showConstraintModal}
        onClose={() => setShowConstraintModal(false)}
        title="Add Constraint"
      >
        <div className="space-y-4">
          <Select
            id="constraintType"
            label="Constraint Type"
            value={newConstraint.type}
            onChange={(e) => setNewConstraint({ ...newConstraint, type: e.target.value })}
            options={[
              { value: "MUST_SIT_TOGETHER", label: "Must Sit Together" },
              { value: "MUST_NOT_SIT_TOGETHER", label: "Must Not Sit Together" },
              { value: "MAX_SELLERS_PER_TABLE", label: "Max Sellers Per Table" },
              { value: "MIN_BUYERS_PER_TABLE", label: "Min Buyers Per Table" },
            ]}
          />

          {(newConstraint.type === "MAX_SELLERS_PER_TABLE" || newConstraint.type === "MIN_BUYERS_PER_TABLE") && (
            <Input
              id="value"
              type="number"
              label="Value"
              min={1}
              max={10}
              value={newConstraint.value}
              onChange={(e) => setNewConstraint({ ...newConstraint, value: parseInt(e.target.value) || 2 })}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Guests
            </label>
            <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
              {event.guests.map((guest) => (
                <label key={guest.id} className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newConstraint.guestIds.includes(guest.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNewConstraint({
                          ...newConstraint,
                          guestIds: [...newConstraint.guestIds, guest.id],
                        });
                      } else {
                        setNewConstraint({
                          ...newConstraint,
                          guestIds: newConstraint.guestIds.filter((id) => id !== guest.id),
                        });
                      }
                    }}
                    className="rounded border-gray-300 text-primary-600 mr-3"
                  />
                  <span className="text-sm">{guest.name}</span>
                  {guest.company && (
                    <span className="text-xs text-gray-500 ml-2">({guest.company})</span>
                  )}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={() => setShowConstraintModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddConstraint}>
              Add Constraint
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// Guest Form Component
function GuestForm({
  guest,
  onSubmit,
  onCancel,
}: {
  guest: Guest | null;
  onSubmit: (data: Partial<Guest>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: guest?.name || "",
    email: guest?.email || "",
    company: guest?.company || "",
    department: guest?.department || "",
    jobTitle: guest?.jobTitle || "",
    seniority: guest?.seniority || "",
    guestType: guest?.guestType || "NEUTRAL",
    notes: guest?.notes || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        id="name"
        label="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />
      <Input
        id="email"
        type="email"
        label="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-4">
        <Input
          id="company"
          label="Company"
          value={formData.company}
          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
        />
        <Input
          id="department"
          label="Department"
          value={formData.department}
          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
        />
      </div>
      <Input
        id="jobTitle"
        label="Job Title"
        value={formData.jobTitle}
        onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-4">
        <Select
          id="seniority"
          label="Seniority"
          value={formData.seniority}
          onChange={(e) => setFormData({ ...formData, seniority: e.target.value })}
          options={[
            { value: "", label: "Select..." },
            { value: "JUNIOR", label: "Junior" },
            { value: "MID", label: "Mid-Level" },
            { value: "SENIOR", label: "Senior" },
            { value: "EXECUTIVE", label: "Executive" },
          ]}
        />
        <Select
          id="guestType"
          label="Guest Type"
          value={formData.guestType}
          onChange={(e) => setFormData({ ...formData, guestType: e.target.value })}
          options={[
            { value: "NEUTRAL", label: "Neutral" },
            { value: "BUYER", label: "Buyer" },
            { value: "SELLER", label: "Seller" },
            { value: "CATALYST", label: "Catalyst" },
          ]}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          className="w-full border rounded-lg p-2 text-sm"
          rows={2}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </div>
      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">{guest ? "Update" : "Add"} Guest</Button>
      </div>
    </form>
  );
}

// Helper functions
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function mapSeniority(value: string): string | null {
  const v = value.toUpperCase().trim();
  if (["JUNIOR", "JR", "ENTRY"].includes(v)) return "JUNIOR";
  if (["MID", "MIDDLE", "MID-LEVEL"].includes(v)) return "MID";
  if (["SENIOR", "SR", "LEAD"].includes(v)) return "SENIOR";
  if (["EXECUTIVE", "EXEC", "C-LEVEL", "VP", "DIRECTOR"].includes(v)) return "EXECUTIVE";
  return null;
}

function mapGuestType(value: string): string {
  const v = value.toUpperCase().trim();
  if (["BUYER", "BUY", "CUSTOMER", "CLIENT"].includes(v)) return "BUYER";
  if (["SELLER", "SELL", "VENDOR", "SALES"].includes(v)) return "SELLER";
  if (["CATALYST", "HOST", "FACILITATOR"].includes(v)) return "CATALYST";
  return "NEUTRAL";
}
