import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  MapPin, 
  User, 
  Sword, 
  Scroll, 
  Package, 
  Users,
  ArrowRight
} from 'lucide-react';

interface GraphNode {
  id: string;
  type: string;
  name: string;
}

interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

interface AdventureGraphProps {
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

const typeColors: Record<string, string> = {
  AdventureModule: 'bg-purple-500',
  Location: 'bg-blue-500',
  NPC: 'bg-green-500',
  Encounter: 'bg-red-500',
  Quest: 'bg-yellow-500',
  Item: 'bg-orange-500',
  Faction: 'bg-pink-500',
  Handout: 'bg-gray-500'
};

const typeIcons: Record<string, any> = {
  AdventureModule: Scroll,
  Location: MapPin,
  NPC: User,
  Encounter: Sword,
  Quest: Scroll,
  Item: Package,
  Faction: Users,
  Handout: Scroll
};

export function AdventureGraph({ graph }: AdventureGraphProps) {
  const { nodesByType, connectionMap } = useMemo(() => {
    const byType: Record<string, GraphNode[]> = {};
    const connections: Record<string, GraphEdge[]> = {};
    
    for (const node of graph.nodes) {
      if (!byType[node.type]) {
        byType[node.type] = [];
      }
      byType[node.type].push(node);
    }
    
    for (const edge of graph.edges) {
      if (!connections[edge.source]) {
        connections[edge.source] = [];
      }
      connections[edge.source].push(edge);
    }
    
    return { nodesByType: byType, connectionMap: connections };
  }, [graph]);

  const getNodeConnections = (nodeId: string) => {
    return connectionMap[nodeId] || [];
  };

  const findNodeById = (id: string) => {
    return graph.nodes.find(n => n.id === id);
  };

  if (!graph.nodes.length) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No adventure graph data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {Object.entries(nodesByType).map(([type, nodes]) => (
          <Badge 
            key={type} 
            variant="outline" 
            className="flex items-center gap-1"
            style={{ color: '#0f172a' }}
          >
            {typeIcons[type] && (() => {
              const Icon = typeIcons[type];
              return <Icon className="h-3 w-3" />;
            })()}
            {type}: {nodes.length}
          </Badge>
        ))}
      </div>

      <div className="grid gap-4">
        {Object.entries(nodesByType).map(([type, nodes]) => (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2" style={{ color: '#0f172a' }}>
                <div className={`w-3 h-3 rounded-full ${typeColors[type] || 'bg-gray-500'}`} />
                {type}s ({nodes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {nodes.map((node) => {
                  const connections = getNodeConnections(node.id);
                  return (
                    <div
                      key={node.id}
                      className="p-3 bg-muted/50 rounded-lg border"
                    >
                      <div className="font-medium text-sm" style={{ color: '#0f172a' }}>{node.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{node.id}</div>
                      {connections.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {connections.slice(0, 3).map((edge, i) => {
                            const targetNode = findNodeById(edge.target);
                            return (
                              <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                                <ArrowRight className="h-3 w-3" />
                                <span className="truncate">
                                  {edge.label && <span className="text-primary">{edge.label}:</span>}{' '}
                                  {targetNode?.name || edge.target}
                                </span>
                              </div>
                            );
                          })}
                          {connections.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{connections.length - 3} more connections
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm" style={{ color: '#0f172a' }}>Connection Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-1" style={{ color: '#0f172a' }}>
            <div>Total Nodes: {graph.nodes.length}</div>
            <div>Total Connections: {graph.edges.length}</div>
            <div className="mt-2">
              <strong>Edge Types:</strong>
              <div className="flex flex-wrap gap-1 mt-1">
                {[...new Set(graph.edges.map(e => e.label).filter(Boolean))].map(label => (
                  <Badge key={label} variant="secondary" className="text-xs">
                    {label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
