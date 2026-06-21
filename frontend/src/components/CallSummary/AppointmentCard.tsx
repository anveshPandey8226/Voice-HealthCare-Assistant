"use client";

import { Calendar, Clock, User, CheckCircle, XCircle } from "lucide-react";
import clsx from "clsx";
import type { Appointment } from "@/types";

interface Props {
  appointment: Appointment;
}

export function AppointmentCard({ appointment }: Props) {
  const confirmed = appointment.status === "confirmed";

  return (
    <div className={clsx(
      "rounded-xl border p-3 flex items-start gap-3",
      confirmed ? "border-green-700/40 bg-green-950/30" : "border-gray-700/40 bg-gray-800/30"
    )}>
      {confirmed
        ? <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
        : <XCircle className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
      }
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 text-sm text-white/80">
          <Calendar className="w-3.5 h-3.5 text-white/40" />
          <span>{appointment.date}</span>
          <Clock className="w-3.5 h-3.5 text-white/40 ml-1" />
          <span>{appointment.time}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/50">
          <User className="w-3 h-3" />
          <span>{appointment.doctor}</span>
          <span className={clsx(
            "ml-auto px-2 py-0.5 rounded-full font-medium",
            confirmed ? "bg-green-900/60 text-green-300" : "bg-gray-700/60 text-gray-300"
          )}>
            {appointment.status}
          </span>
        </div>
      </div>
    </div>
  );
}
