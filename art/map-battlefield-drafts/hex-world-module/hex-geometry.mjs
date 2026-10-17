/** Pointy-top odd-r coordinates. Clockwise local/world side ordering. */
export const directions=['E','SE','SW','W','NW','NE'];
export function neighbor(column,row,worldIndex){
 const parity=((row%2)+2)%2;
 return [[column+1,row],[column+parity,row+1],[column-1+parity,row+1],[column-1,row],[column-1+parity,row-1],[column+parity,row-1]][worldIndex];
}
export function address(column,row){
 if(!Number.isInteger(column)||!Number.isInteger(row)||column<0||row<0)return null;
 let label='';for(column++;column;column=Math.floor((column-1)/26))label=String.fromCharCode(65+(column-1)%26)+label;
 return label+(row+1);
}
/** Return the authored local edge that faces the given world direction. */
export function worldEdge(tile,worldIndex){
 if(!Number.isInteger(worldIndex)||worldIndex<0||worldIndex>5)return undefined;
 const rotation=tile.orientationSteps??0;
 if(!Number.isInteger(rotation)||rotation<0||rotation>5)return undefined;
 return tile.sides?.[directions[(worldIndex-rotation+6)%6]];
}
