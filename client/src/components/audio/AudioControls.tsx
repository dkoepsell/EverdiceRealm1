/**
 * Compact audio control: a Navbar button (volume icon) that opens a popover with a
 * mute toggle and master/music/effects volume sliders. Adjusting "Effects" previews
 * a dice sound on release so the level is audible.
 */
import { useAudio } from "@/hooks/use-audio";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Volume2, VolumeX, Music2, Swords } from "lucide-react";
import { ReactNode } from "react";

function VolumeRow({
  icon,
  label,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
        <span className="ml-auto tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <Slider
        value={[value * 100]}
        max={100}
        step={1}
        disabled={disabled}
        aria-label={`${label} volume`}
        onValueChange={(v) => onChange((v[0] ?? 0) / 100)}
        onValueCommit={onCommit}
      />
    </div>
  );
}

export default function AudioControls() {
  const audio = useAudio();
  const silent = audio.muted || audio.master === 0;
  const TriggerIcon = silent ? VolumeX : Volume2;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Audio settings" title="Audio">
          <TriggerIcon className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Audio</span>
          <Button variant={audio.muted ? "secondary" : "ghost"} size="sm" onClick={audio.toggleMute}>
            {audio.muted ? (
              <>
                <VolumeX className="mr-1.5 h-4 w-4" /> Muted
              </>
            ) : (
              <>
                <Volume2 className="mr-1.5 h-4 w-4" /> Mute
              </>
            )}
          </Button>
        </div>

        <VolumeRow
          icon={<Volume2 className="h-4 w-4" />}
          label="Master"
          value={audio.master}
          disabled={audio.muted}
          onChange={audio.setMaster}
        />
        <VolumeRow
          icon={<Music2 className="h-4 w-4" />}
          label="Music"
          value={audio.music}
          disabled={audio.muted}
          onChange={audio.setMusic}
        />
        <VolumeRow
          icon={<Swords className="h-4 w-4" />}
          label="Effects"
          value={audio.sfx}
          disabled={audio.muted}
          onChange={audio.setSfx}
          onCommit={() => audio.playSfx("dice")}
        />
      </PopoverContent>
    </Popover>
  );
}
