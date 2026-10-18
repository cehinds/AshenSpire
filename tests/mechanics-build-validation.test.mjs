import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGame } from '../tools/build-game.mjs';
const ward='defense.wardProtection';
const cases=[
 ['unknown static effect fields',({content})=>{content.cards[0].effects=[{op:'damage',amount:1,amunt:2}];},/unknown parameter 'amunt'/],
 ['nonfinite quantities',({content})=>{content.cards[0].effects=[{op:'damage',amount:Infinity}];},/not a value|nonfinite number/],
 ['unknown modifier operation',({mechanics})=>{mechanics[ward].service.modifiers[0].operation='typo';},/unknown operation typo/],
 ['unknown modifier parameters',({mechanics})=>{mechanics[ward].service.modifiers[0].amunt=3;},/unknown modifier field/],
 ['modifier dependencies',({mechanics})=>{const row=mechanics[ward].service.modifiers[0];row.after=[row.id];},/dependency cycle/],
 ['mechanic dependency cycle',({mechanics})=>{mechanics[ward].interface.requires=[ward];},/dependency cycle/],
 ['invalid defaults',({mechanics})=>{mechanics[ward].manifest.parameters.properties.multiplier.default=1.5;},/<= 1/],
 ['unsupported parameter schema keyword',({mechanics})=>{mechanics[ward].manifest.parameters.properties.multiplier.executable='text';},/unsupported parameter schema field/],
 ['missing required behavior',({mechanics})=>{mechanics[ward].service.modifiers=[];},/no executable behavior/],
 ['authored binding typo',({content})=>{content.gear[0].mechanicBindings=[{tag:'defense:typo'}];},/unknown behavior tag/],
];
for(const [name,patch,message] of cases)test(`build refuses ${name} with source diagnostics`,()=>assert.throws(()=>buildGame({patch}),message));
