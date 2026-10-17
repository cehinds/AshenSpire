import {directions,worldEdge} from './hex-geometry.mjs';
/** Validate expanded edges. Compact template edges must be expanded before use. */
export function validateEdge(edge,profiles){
 const errors=[];
 if(!edge||typeof edge!=='object')return ['Edge must be an object.'];
 const profile=profiles.find(p=>p.id===edge.edgeProfileId);
 if(!profile)return [`Unknown edge profile ${edge.edgeProfileId}.`];
 if(!Array.isArray(edge.tags)||new Set(edge.tags).size!==edge.tags.length||edge.tags.length!==profile.tags.length||profile.tags.some(tag=>!edge.tags.includes(tag)))errors.push(`Tags must exactly match profile ${profile.id}.`);
 const connector=edge.connector;
 if(profile.connectorKind===null){if(connector!==null)errors.push(`Profile ${profile.id} must have no connector.`);}
 else if(!connector||connector.kind!==profile.connectorKind)errors.push(`Connector must match profile ${profile.id}.`);
 else if(profile.connectorKind==='river'){if(!['in','out'].includes(connector.flow))errors.push('River flow must be in or out.');}
 else if(connector.flow!==null)errors.push('Road flow must be null.');
 return errors;
}
export function compareEdges(a,b,profiles){
 const reasons=[...validateEdge(a,profiles).map(s=>'First edge: '+s),...validateEdge(b,profiles).map(s=>'Second edge: '+s)];
 if(a?.edgeProfileId!==b?.edgeProfileId)reasons.push('Edge profiles must match exactly.');
 if((a?.connector?.kind??null)!==(b?.connector?.kind??null))reasons.push('Connector kinds must match.');
 if(a?.connector?.kind==='river'&&a.connector.flow===b?.connector?.flow)reasons.push('River flow must be opposite.');
 return {compatible:reasons.length===0,reasons};
}
/** Neighbors are [{worldIndex,edge}], where edge already faces this candidate. */
export function rotationCandidates(template,position,neighbors,profiles,allowedRotations=template.allowedRotations){
 const sides={};
 for(const direction of directions){const compact=template.sides?.[direction];const profile=profiles.find(p=>p.id===compact?.edgeProfileId);if(!profile)return [];sides[direction]={edgeProfileId:profile.id,tags:[...profile.tags],connector:profile.connectorKind===null?null:{kind:profile.connectorKind,flow:compact.flow}};}
 if(directions.some(direction=>validateEdge(sides[direction],profiles).length))return [];
 return allowedRotations.filter(rotation=>Number.isInteger(rotation)&&rotation>=0&&rotation<6&&neighbors.every(({worldIndex,edge})=>compareEdges(worldEdge({position,orientationSteps:rotation,sides},worldIndex),edge,profiles).compatible));
}
