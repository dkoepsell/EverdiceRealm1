import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { joinCampaign, leaveCampaign } from "@/lib/websocket";

export interface PartyPosition {
  hexQ: number;
  hexR: number;
}

/**
 * Live party position for one campaign.
 *
 * Subscribes the socket to the campaign so the server sends movement only to this table
 * rather than fanning it out to every connected client, then keeps the world-map queries
 * fresh as the party moves. Returns the last position seen over the socket, or null until
 * the party moves while this component is mounted.
 */
export function usePartyPosition(campaignId: number | null | undefined) {
  const queryClient = useQueryClient();
  const [position, setPosition] = useState<PartyPosition | null>(null);

  useEffect(() => {
    if (!campaignId) return;

    joinCampaign(campaignId);
    setPosition(null);

    const onMoved = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      // The server scopes this by subscription, but a socket that just switched
      // campaigns can still see one in-flight message for the previous one.
      if (detail?.campaignId && detail.campaignId !== campaignId) return;
      if (typeof detail?.hexQ !== "number" || typeof detail?.hexR !== "number") return;

      setPosition({ hexQ: detail.hexQ, hexR: detail.hexR });
      queryClient.invalidateQueries({ queryKey: ["/api/world/party-positions"] });
      queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/world-context`] });
      queryClient.invalidateQueries({ queryKey: [`/api/wander/hexes/${campaignId}`] });
    };

    window.addEventListener("party_moved", onMoved);
    return () => {
      window.removeEventListener("party_moved", onMoved);
      leaveCampaign();
    };
  }, [campaignId, queryClient]);

  return position;
}
