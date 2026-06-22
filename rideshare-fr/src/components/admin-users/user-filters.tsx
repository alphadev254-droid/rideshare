import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type RoleFilter = "all" | "passenger" | "driver" | "admin";
export type ActiveFilter = "all" | "active" | "inactive";
export type DriverProfileFilter = "all" | "no_profile" | "not_submitted" | "pending" | "approved";

interface UserFiltersProps {
  search: string;
  role: RoleFilter;
  active: ActiveFilter;
  driverProfileStatus: DriverProfileFilter;
  isLoading?: boolean;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: RoleFilter) => void;
  onActiveChange: (value: ActiveFilter) => void;
  onDriverProfileStatusChange: (value: DriverProfileFilter) => void;
  onSubmit: () => void;
}

export function UserFilters({
  search,
  role,
  active,
  driverProfileStatus,
  isLoading,
  onSearchChange,
  onRoleChange,
  onActiveChange,
  onDriverProfileStatusChange,
  onSubmit,
}: UserFiltersProps) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_150px_150px_190px_auto]">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          placeholder="Search name, phone or email"
        />
        <Select value={role} onValueChange={(value) => onRoleChange(value as RoleFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="passenger">Passengers</SelectItem>
            <SelectItem value="driver">Drivers</SelectItem>
            <SelectItem value="admin">Admins</SelectItem>
          </SelectContent>
        </Select>
        <Select value={active} onValueChange={(value) => onActiveChange(value as ActiveFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={driverProfileStatus}
          onValueChange={(value) => onDriverProfileStatusChange(value as DriverProfileFilter)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All driver profiles</SelectItem>
            <SelectItem value="no_profile">No profile</SelectItem>
            <SelectItem value="not_submitted">Not submitted</SelectItem>
            <SelectItem value="pending">Pending approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={onSubmit} disabled={isLoading} className="gap-2">
          <Search className="h-4 w-4" />
          Search
        </Button>
      </div>
    </div>
  );
}
