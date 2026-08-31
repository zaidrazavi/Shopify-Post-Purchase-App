// Local presentational helpers take plain props; this project doesn't use the
// prop-types runtime checker, so disable that rule for this file.
/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useFetcher, redirect } from "react-router";
import { toast } from "sonner";
import { authenticate } from "../shopify.server";
import {
  getFunnels,
  createFunnel,
  duplicateFunnel,
  deleteFunnel,
  toggleFunnelStatus,
} from "../models/funnel.server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Pencil,
  Trash2,
  MoreHorizontal,
  Search,
  Copy,
  ShoppingCart,
  CheckCircle2,
  Heart,
} from "lucide-react";

const TYPE_CONFIG = {
  "pre-purchase": {
    label: "Pre-Purchase",
    title: "Pre-Purchase Funnels",
    description: "Upsell offers shown before checkout",
    icon: ShoppingCart,
  },
  "post-purchase": {
    label: "Post-Purchase",
    title: "Post-Purchase Funnels",
    description: "Upsell offers shown after checkout completion",
    icon: CheckCircle2,
  },
  "thank-you": {
    label: "Thank You Page",
    title: "Thank You Page Funnels",
    description: "Offers and widgets on the thank you page",
    icon: Heart,
  },
};

// Validate the :type segment; 404 for anything else.
function validateType(type) {
  if (!TYPE_CONFIG[type]) {
    throw new Response("Not Found", { status: 404 });
  }
  return type;
}

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const type = validateType(params.type);

  // TEMPORARY: the Phase 2 tables (Funnel/…) aren't applied to the dev DB yet,
  // so scope the query in try/catch — on failure return an empty list so the
  // page renders its empty state instead of crashing. Remove once deployed.
  let funnels = [];
  try {
    funnels = await getFunnels(session.shop, type);
  } catch {
    funnels = [];
  }

  return { funnels, type };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const type = validateType(params.type);
  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "create") {
      const name = (form.get("name")?.toString().trim() || "New Funnel");
      const funnel = await createFunnel(shop, { type, name });
      // On success, straight into the (Phase 3D) editor.
      return redirect(`/app/funnels/${type}/${funnel.id}`);
    }

    const funnelId = form.get("funnelId")?.toString();
    if (!funnelId) return { ok: false, error: "Missing funnel id" };

    if (intent === "duplicate") {
      const f = await duplicateFunnel(shop, funnelId);
      return f ? { ok: true, message: "Funnel duplicated" } : { ok: false, error: "Funnel not found" };
    }
    if (intent === "delete") {
      const ok = await deleteFunnel(shop, funnelId);
      return ok ? { ok: true, message: "Funnel deleted" } : { ok: false, error: "Funnel not found" };
    }
    if (intent === "toggle-status") {
      const f = await toggleFunnelStatus(shop, funnelId);
      return f
        ? { ok: true, message: f.status === "active" ? "Funnel activated" : "Funnel paused" }
        : { ok: false, error: "Funnel not found" };
    }
    return { ok: false, error: "Unknown action" };
  } catch (error) {
    // TEMPORARY: Phase 2 tables may not exist in dev yet — surface a friendly
    // error (e.g. CREATE will fail until the migration is deployed).
    return { ok: false, error: error?.message || "Operation failed" };
  }
};

export default function FunnelList() {
  const { funnels, type } = useLoaderData();
  const config = TYPE_CONFIG[type] || TYPE_CONFIG["pre-purchase"];
  const Icon = config.icon;
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("New Funnel");
  const [deleteId, setDeleteId] = useState(null);
  const [search, setSearch] = useState("");

  const busy = fetcher.state !== "idle";

  // Surface action results as toasts (create redirects on success, so only its
  // error path reaches here).
  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.ok) {
      toast.success(fetcher.data.message || "Done");
      setCreateOpen(false);
    } else if (fetcher.data.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.data]);

  const filtered = funnels.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  const submit = (fields) => fetcher.submit(fields, { method: "post" });

  const editHref = (id) => `/app/funnels/${type}/${id}`;

  const handleCreate = () => {
    const name = newName.trim() || "New Funnel";
    submit({ intent: "create", name });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{config.title}</h1>
          <p className="text-sm text-muted-foreground">{config.description}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add New Funnel
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search funnels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* List or empty state */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="rounded-full bg-muted p-4">
              <Icon className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">
                No {config.label.toLowerCase()} funnels yet
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first {config.label.toLowerCase()} funnel to start boosting revenue.
              </p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Funnel
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Priority</TableHead>
                <TableHead>Funnel Name</TableHead>
                <TableHead className="text-center">Offers</TableHead>
                <TableHead className="text-center">Views</TableHead>
                <TableHead className="text-center">Conversion</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((funnel) => {
                // Metrics derived from the Event table (single source of truth),
                // provided by getFunnels.
                const views = funnel.impressions ?? 0;
                const revenue = funnel.revenue ?? 0;
                const conversion =
                  views > 0
                    ? Number((((funnel.conversions ?? 0) / views) * 100).toFixed(2))
                    : 0;

                return (
                  <TableRow
                    key={funnel.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(editHref(funnel.id))}
                  >
                    <TableCell className="font-medium text-muted-foreground">
                      {funnel.priority}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-foreground">{funnel.name}</span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {funnel.offerCount ?? 0}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {views.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {conversion}%
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ${revenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={funnel.status === "active"}
                        disabled={busy}
                        onCheckedChange={() =>
                          submit({ intent: "toggle-status", funnelId: funnel.id })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => navigate(editHref(funnel.id))}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(editHref(funnel.id))}>
                              <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => submit({ intent: "duplicate", funnelId: funnel.id })}
                            >
                              <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleteId(funnel.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create {config.label} Funnel</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Funnel Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`e.g. ${config.label} Upsell`}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={busy || !newName.trim()}>
              {busy ? "Creating..." : "Create Funnel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Funnel?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this funnel and all its offers. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) submit({ intent: "delete", funnelId: deleteId });
                setDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
