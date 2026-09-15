// Language-agnostic documentation blocks, not executable game implementations.
export const pseudocode = {
W0: `INPUT: definitionId, immutableViewModel, commandBindings, host, inputContext
OUTPUT: viewHandle(update, dispose), semantic intents

FUNCTION MountMaster(inputs):
    definition = ResolveValidatedInheritance(definitionId)
    REQUIRE definition ancestry ends at W0; reject cycles/unknown fields
    viewport = SharedViewportAdapter.AvailableLocalSize(host)
    mode = ChooseContentFitMode(viewport, textScale, targetMinimums)
    shell = CreateHeaderBodyFooterOnce()
    ReserveHeaderAndFooterOutsideBodyScroll(shell)
    ApplyInheritedPaddingSpacingEffects(shell, definition)
    Anchor(title, TOP_LEFT); Anchor(exit, TOP_RIGHT)
    IF definition.titlePlacement == screenCenter: CenterTitleOnFullHost()
    RenderOnlyApplicableComponents(immutableViewModel.capabilities)
    RenderRegisteredBody(immutableViewModel.body)
    RenderFooter(immutableViewModel.actions, definition.footerPlacement)
    BindTopmostInputFocusAndDismissal(shell, definition.interactionPolicy)
    RETURN handle that updates stable nodes and disposes listeners/audio/timers

FUNCTION RenderFooter(actions, placement):
    visible = FilterByDeclaredVisibility(actions) // disabled visible actions count
    IF count(visible) == 0: OmitFooter(); RETURN
    IF count(visible) == 1:
        PlaceOneButtonFullUsableWidth(labelCentered = true); RETURN
    IF placement == packedCombat:
        CenterOneGroup(Actions, Draw, EndTurn, DiscardExhaust, Potions)
        UseMinimalSharedGapsAndPairedSideSizes()
    ELSE:
        Anchor(CloseOrBack, BOTTOM_LEFT); Anchor(Primary, BOTTOM_RIGHT)
        IF declaredMiddleAction exists: Anchor(declaredMiddleAction, CENTER)
    KeepButtonsAndLabelsOnOneHorizontalRow()
    UseConciseLabelsAndSharedSizingWithinTextAndTargetMinimums()
    IF supported size still cannot fit: ReportLayoutFailure(); never silently stack

FUNCTION ResolveControlStyle(action, inputState):
    IF action absent by capability: RETURN absent
    IF action.busy OR NOT action.canActivate: RETURN neutralBrownGoldMuted
    IF action has registeredException: RETURN ResolveException(action, inputState)
    highlighted = hover OR keyboardFocus OR controllerFocus OR selected
    IF action.role == exit: RETURN highlighted ? redEmphasis : brownGold
    IF action.role == primary: RETURN highlighted ? strongGreen : readyGreen
    RETURN highlighted ? goldEmphasis : brownGold

ON resize/orientation/textScale:
    ReprojectLayoutOnly(); PreserveSelectionFocusAndInProgressDomainState()
ON Close/Back/Primary:
    EmitBoundIntentIfAllowed(); never infer behavior from label or color
ON dispose:
    CloseOnceWithReason(dispose); ReleaseAllOwnedResources()`,
W1: `INPUT: workspaceDefinition, categories, activeCategoryId, bodyModel, actions
INHERITS: W0 geometry, footer, palette, transitions, focus, cleanup

FUNCTION RenderWorkspace(model):
    validCategory = ResolveAvailableCategory(model.activeCategoryId)
    navigation = IF count(categories) > 1 THEN
        wide: LeftRail(categories)
        compact/portrait: AccessibleCategorySelector(categories)
      ELSE absent
    body = ProjectOnlyActiveCategory(validCategory)
    RETURN W0.MountOrUpdate(header, navigation, body, actions)

ON chooseCategory(id):
    REQUIRE id is available
    SaveLocalSelectionForCurrentCategory()
    DisposeCurrentBodyBindings(); set activeCategoryId = id
    RestoreLocalSelectionFor(id); update same shell
    DoNotCommitGameplayMerelyBecauseCategoryChanged()

Selection, inspection and choices are registered BODY variants here.
Do not mount a second W0 inside the body.`,
W1a: `INPUT: settingsSnapshot, settingsDefinitions, browserCapabilities
PARENT: W1
model.categories = ProjectRegisteredSettingCategories()
model.body = ProjectSettingRows(activeCategory, values, capabilities)
model.actions = ProjectExistingSettingsActions()
RenderWithW1(model)
ON changeSetting(id, value):
    ValidateTypeRangeAndCapability(id, value)
    DispatchSettingsCommandUsingItsExistingApplyOrImmediateSavePolicy()
    RefreshValuesAndFeedback(); do not navigate or rebuild the shell
ON failedBrowserCapability: ShowReasonWithoutPretendingChangeSucceeded()
Palette controls edit shared theme records, not per-component colors.`,
W1b: `INPUT: townDefinition, playerSnapshot, npcAndServiceRegistries
PARENT: W1
available = EvaluateTownMembershipAndProgressionPredicates()
model.categories = ProjectNPCServiceCategories(available)
model.header = TownNameAndConciseResources()
model.body = SmallNPCPortraitAndActiveServiceModel(selectedNPC)
model.actions = LeaveAndTalkOrOpenFromDomainCapabilities()
RenderWithW1(model) // no extra scene or HUD band
ON chooseNPC(id): ChangeLocalCategorySelectionOnly(id)
ON Talk/Open: NavigateToRegisteredDialogueOrService(selectedNPC)
ON return: RestoreSelectedNPCAndRefreshAvailability()
ON Leave/Close: DispatchApprovedTownExitIntent(); never bypass a required choice`,
W1c: `INPUT: creationDefinitions, draftCharacter, proposedDestinationSlot
PARENT: W1
model.categories = AvailableCreationStagesWithPrerequisiteReasons()
model.header = TitleAndSmallPortrait(draftCharacter)
model.body = ProjectOnlyActiveStage(draftCharacter)
IF stage == attributes:
    DisplayBudgetAndDerivedEffectsFromDomainProjection()
    UseTwoColumnControlsIfTheyFitOtherwiseOneColumn()
IF stage has tooManyChoices: UseExplicitPagesPreservingSelection()
model.actions = BackAndNextOrBegin()
RenderWithW1(model); ReservePersistentInlineFooter()
ON editDraft: ValidateDraftChange(); ReprojectWithoutSavingRun()
ON Next: ValidateActiveStage(); SelectNextAvailableStage()
ON Back: RestorePreviousStageWithoutDiscardingDraft()
ON Begin:
    RevalidateWholeDraftAndDestinationSlot()
    RequestExistingReplacementConfirmationIfNeeded()
    CommitCreationOnceThroughDomainCommand()
Allow one active-pane scroll only when readable content cannot fit.`,
W1d: `INPUT: savedShopStock, runSnapshot, shopDefinitions, localSelection
PARENT: W1; BODY: W1v offer model
model.categories = ProjectAvailableShopCategoriesFromData()
model.header = MerchantAndCurrentCurrency()
model.body = ProjectOffersFor(activeCategory, savedShopStock)
model.actions = LeaveAndApplicableSelectedOfferAction()
RenderWithW1(model)
ON chooseOffer(stableRef): UpdateSelectionAndDomainPreview(stableRef)
ON Buy/Sell/Remove:
    DispatchRegisteredCommandWithStableRefAndRequestId()
    RevalidateFundsCapacityOwnershipAndStockAtCommit()
    RefreshAfterResult(); PreserveCategoryAndSelectionWhenStillValid()
Do not reroll stock or use stale array indexes as transaction identity.`,
W1e: `INPUT: loadoutSnapshot, armouryDefinitions, savedViewPreference
PARENT: W1
model.categories = CharacterInventoryHybridWithExistingSavedIDs()
model.body = ProjectActiveArmouryPaneUsingExistingLoadoutQueries()
model.actions = BackAndApplicableEquipmentAction()
RenderWithW1(model)
ON view/pane change: PreserveLocalSelectionAndTraySizes()
ON selectItem: RenderW1nBodyInsideExistingShell()
ON equip/unequip/swap: DispatchExistingValidatedEquipmentCommand()
ON result: RefreshAffectedStatsGrantsAndReceiptsFromDomain()
Never copy loadout math or rename persisted grid/rack/hybrid IDs.`,
W1f: `INPUT: contentRegistries, discoverySnapshot, categoryAndEntrySelection
PARENT: W1
model.categories = RegisteredCompendiumGroups()
model.body = KnownEntryListAndSelectedEntryProjection()
model.actions = BackOnlyWhenApplicable()
RenderWithW1(model)
ON selectCategory/entry: ChangeLocalSelection(); ReprojectKnownFacts()
ON inspect: UseSharedInspectionBodyOrModalAsNavigationRequires()
Do not reveal undiscovered information or mutate progression on inspection.`,
W1g: `INPUT: profileSnapshot, profileCapabilities, categorySelection
PARENT: W1
model.categories = ExistingSupportedProfileCategories()
model.body = ProfileIdentityAndActiveCategoryRecords()
model.actions = ProjectActualBackAndPrimaryCapabilities()
RenderWithW1(model)
IF one footer action: W0 stretches it full width
IF two: W0 keeps Back left and concise primary right, INLINE
ON profileAction(recordId): DispatchExistingProfileCommandAndPolicy()
ON result: RefreshProfileRecordsAndStatus()
Do not conflate archive/restore/profile actions with run-slot deletion.`,
W1h: `INPUT: committedCombatSnapshot, selectedPile, selectedCardRef
PARENT: W1
model.categories = DiscardAndExhaustWithCounts()
model.body = ProjectCardsIn(selectedPile)
model.actions = CloseIfApplicable()
RenderWithW1(model)
ON selectPile: PreserveCardSelectionIfStillPresent(); update body
ON selectCard: ProjectReadOnlyCardDetails()
ON combatSnapshotChange: RefreshCountsAndInvalidateMissingSelection()
No draw, discard, exhaust, or turn mutation occurs by opening this viewer.`,
W1i: `INPUT: serviceDefinition, runSnapshot, selectedItemRef
PARENT: W1; BODY: selection/detail
plan = ExistingSmithingPlan(runSnapshot)
model.body = CandidateRowsAndUpgradeDelta(plan, selectedItemRef)
model.actions = BackAndUpgrade(plan.canConfirm, plan.reason)
RenderWithW1(model)
ON selectItem(ref): SetLocalSelection(ref); RecomputePlanAndPreview()
ON Upgrade: DispatchExistingUpgradeCommand(ref, reviewedConsequence, requestId)
IF stale/rejected: KeepOpenAndRefreshReason()
IF committed: FollowConfiguredExistingCloseOrMultiUseContinuation()
Cancel must leave domain state unchanged.`,
W1j: `INPUT: extractionDefinition, runSnapshot, itemSelection, mountSelection
PARENT: W1; BODY: selection/detail with mount selector
plan = ExistingExtractionPlan(runSnapshot)
model.body = ItemsMountsCardAndFallbackPreview(plan, selections)
model.actions = BackAndExtractWithEligibility()
RenderWithW1(model)
ON selectItem: ClearMountSelection(); Reproject()
ON selectMount: SetLocalMountSelection(); Reproject()
ON Extract: DispatchExistingExtractionCommand(itemRef, mountKey, requestId)
ON success: RefreshReceiptAndConfiguredContinuation()
Back/Close never extracts or changes a fallback card.`,
W1k: `INPUT: installDefinition, runSnapshot, itemMountCardSelection
PARENT: W1; BODY: selection/detail with dependent selectors
plan = ExistingInstallPlan(runSnapshot)
model.body = ItemsMountsCompatibleCardsAndCost(plan, selection)
model.actions = BackAndInstallWithEligibility()
RenderWithW1(model)
ON selectItem: ClearMountAndCardSelection(); Reproject()
ON selectMount: ClearCardSelection(); Reproject()
ON selectCard(instanceId): ValidateLocalCandidate(); Reproject()
ON Install: DispatchExistingInstallCommand(itemRef, mountKey, instanceId, requestId)
ON rejection: PreserveValidSelectionsAndShowCurrentReason()
Do not change card ownership until the command commits.`,
W1l: `INPUT: saveSlotSummaries, selectedSlot, draftCreationContext
PARENT: W1; BODY: shared SaveSlotSelection(mode = new)
model.body = SlotsWithEmptyAndOccupiedStates()
model.actions = BackAndCreateCharacter(selectedSlotIsValid)
RenderWithW1(model)
ON selectSlot(id): StoreProposedDestinationOnly()
ON CreateCharacter: OpenW1cWithDraftAndProposedDestination()
ON cancel: ReturnWithoutDeletingOrOverwritingAnySlot()
Occupied-slot replacement follows W2c at the approved write boundary.`,
W1m: `INPUT: saveSlotSummaries, selectedSlot, activeRunContext
PARENT: W1; BODY: shared SaveSlotSelection(mode = load)
model.body = SlotsWithLoadabilityAndReasons()
model.actions = BackAndLoad(selectedSlotCanLoad)
RenderWithW1(model)
ON selectSlot: UpdateLocalSelectionOnly()
ON Load:
    RefreshAndValidateSelectedSaveIdentity()
    IF activeProgressRequiresDecision: OpenW2dWithExactTarget()
    ELSE DispatchExistingLoadCommand()
ON DeleteSelected: OpenW2b; never delete on ordinary selection
Empty/unreadable/incompatible slots cannot load.`,
W1n: `INPUT: inventorySnapshot, equipmentContext, selectedItemRef
PARENT: W1; BODY: selection/detail, embeddable inside W1e
plan = ExistingEquipmentPreview(selectedItemRef, equipmentContext)
model.body = InventoryRowsAndSelectedComparison(plan)
model.actions = BackAndEquip(plan.allowed, plan.reason)
RenderInExistingW1BodyOrMountW1AsContextRequires()
ON selectItem: UpdateLocalSelectionAndPreview()
ON Equip: DispatchExistingEquipmentCommandWithStableRef()
RefreshFromDomainReceipt(); never mutate equipment in renderer.`,
W1o: `INPUT: itemDefinitionRef, instanceSnapshot, inspectionContext
PARENT: W1; BODY: inspection
model.body = ItemNameArtTagsStatsRequirementsAndEffects()
model.actions = ProjectOnlyApplicableItemActions(inspectionContext)
RenderWithW1(model, categoryRail = absent)
ON action: DispatchBoundDomainIntentWithCurrentInstanceRef()
ON close: RestoreOpenerThroughW0()
Inspection alone is read-only; no invented primary button.`,
W1p: `INPUT: combatantRef, committedCombatSnapshot, visibilityRules
PARENT: W1; BODY: inspection
model.body = VisibleCombatantIdentityVitalsStatusesAndIntent()
model.actions = CloseIfApplicable()
RenderWithW1(model, categoryRail = absent)
ON snapshotUpdate: RefreshVisibleFactsWithoutStealingFocus()
ON close: RestoreCombatInputScopeThroughW0()
Do not reveal hidden intent or mutate combat during inspection.`,
W1q: `INPUT: potionRef, runSnapshot, useContext
PARENT: W1; BODY: inspection
plan = ExistingPotionUsePlan(potionRef, useContext)
model.body = PotionIdentityChargesEffectAndEligibility(plan)
model.actions = UseOnlyWhenOfferedByContext()
RenderWithW1(model, categoryRail = absent)
ON Use: DispatchExistingPotionCommandAndRevalidateCharges()
ON result: RefreshChargesAndEffectReceipt()
Charges retain semantic resource colors; Use follows primary-state palette.`,
W1r: `INPUT: activeRunIdentity, activeSlotIdentity, saveStatus
PARENT: W1; BODY: status, no art slot
model.body = CharacterLocationDestinationLastSavedAndStatus()
model.actions = BackAndSave(existingSaveCapability)
RenderWithW1(model)
ON Save:
    SetBusy(); result = PersistenceCoordinator.SaveCurrentCommittedRun()
    ClearBusy(); DisplaySavedOrFailure(result)
ON Retry: RetryPersistenceOnly()
Do not replay gameplay commands or silently select another destination.`,
W1s: `INPUT: restDefinition, runSnapshot, refillAndServiceContext
PARENT: W1; BODY: choice/progression
plan = ExistingRestAndServicePlans()
model.body = RecoveryValuesOptionsCostsAndReasons(plan)
model.actions = ExistingContinueOrRestAction()
RenderWithW1(model)
ON service: OpenRegisteredServicePresenter()
ON recovery: DispatchValidatedRestCommand()
ON result: PreserveExistingOneUseOrMultiUseContinuation()
No healing, refill, or service mutation from rendering a choice.`,
W1t: `INPUT: persistedPendingRewards, currentPossessions, claimState
PARENT: W1; BODY: choice/progression
plan = ExistingRewardPlan(pendingRewards, capacities)
model.body = RewardChoicesAndClaimedAvailableBlockedStates(plan)
model.actions = ContinueFromExistingRewardPolicy(plan)
RenderWithW1(model)
ON chooseReward: DispatchRegisteredClaimCommand(stableRewardRef)
ON Continue: ResolveExistingAutomaticAndOptionalClaimsThroughDomainCommand()
ON result: PersistPendingRewardProgressAndNavigateWhenComplete()
Reload/duplicate activation must not grant a reward twice or reroll choices.`,
W1u: `INPUT: eventDefinition, questHistory, runSnapshot
PARENT: W1; BODY: choice/progression, page presentation when required
choices = ExistingAvailableEventChoices(history, snapshot)
model.body = EventTitleNarrativeChoicesAndConsequences(choices)
model.actions = OnlyLegalExistingContinuationActions()
model.capabilities.close = ApprovedEventExitCapability()
RenderWithW1(model)
ON chooseResponse(choiceId):
    ApplyExistingConfirmationPolicy()
    DispatchEventCommandRevalidatingRequirementsAndRecordingHistoryOnce()
ON result: ShowResultOrNavigateToExistingCombatTransition()
Rendering and navigation Back never apply event effects.`,
W1v: `INPUT: activeShopCategory, savedStock, runSnapshot
PARENT: W1; BODY embedded in W1d, not another complete shell
offers = DomainShopQuery(activeCategory, snapshot, savedStock)
body = OfferCardsWithPricesEligibilityAndSelectedDetails(offers)
ReturnBodyModelToW1d(body)
ON offerSelected: EmitSelectionIntent(stableOfferRef)
ON offerActivated: EmitRegisteredBuySellOrRemoveIntent()
W1d owns navigation/footer; domain command owns pricing and mutation.`,
W2: `INPUT: exactTarget, consequence, decisionPolicy, confirmBinding
PARENT: W0; VARIANT: compact confirmation
model.body = ConcreteQuestionTargetAndConsequence()
model.actions = BackAndConfirmWithCurrentEligibility()
model.paletteException = DestructivePolicyIfApplicable()
MountThroughW0(model); FocusSafeActionAccordingToPolicy()
ON confirm:
    IF alreadyCommitting: RETURN
    RevalidateExactTargetAndReviewedConsequence()
    IF changed: RefreshReviewWithoutCommitting(); RETURN
    result = DispatchBoundCommandOnce(stableRequestId)
    IF rejected: KeepDecisionOpenAndShowReason()
    ELSE CloseWithConfirmReasonAndPreserveNavigationInputShield()
ON Back/Exit: CancelOnceWithoutCallingConfirm()
ON replace/dispose: ReleaseResourcesWithoutPretendingUserConfirmedOrCancelled()`,
W2a: `INPUT: selectedServicePlan, targetRef, existingConfirmationPolicy
PARENT: W2
model = ServiceQuestionExactCostChangesAndTarget(selectedServicePlan)
confirmBinding = RegisteredServiceCommand(targetRef, reviewedConsequence)
RenderWithW2(model, confirmBinding)
ON stalePlan: RefreshSelectionReviewInsteadOfChargingDifferentCost()
ON success: ReturnReceiptToServicePresenter()
All arming, focus, cancellation and input shielding remain inherited.`,
W2b: `INPUT: selectedSaveIdentity, actualRetentionPolicy
PARENT: W2
model = DeleteQuestionForExactSlotAndCharacter()
model.consequence = DeriveActualDeletionOrArchiveConsequence()
model.paletteException = destructive
confirmBinding = DeleteSaveIfIdentityStillMatches()
RenderWithW2(model, confirmBinding)
ON targetChanged: RequireUpdatedReview(); do not delete replacement occupant
ON success: RefreshSlotList(); preserve profile data`,
W2c: `INPUT: occupiedSlotIdentity, validatedNewRunDraft
PARENT: W2
model = ReplacementQuestionOldIdentityNewIdentityAndConsequence()
model.paletteException = destructive
confirmBinding = CommitNewRunToReviewedDestinationWithExistingSaveSemantics()
RenderWithW2(model, confirmBinding)
ON cancel: KeepDraftAndExistingSave()
ON failure: ReportActualStorageOutcome(); never claim replacement succeeded`,
W2d: `INPUT: selectedLoadIdentity, currentRunSaveStatus
PARENT: W2
model = LoadQuestionWithExactCurrentProgressConsequence()
confirmBinding = ExistingLoadCommandForReviewedIdentity()
RenderWithW2(model, confirmBinding)
ON cancel: ReturnToActiveRunWithoutMutation()
ON success: DisposeOldPresenterAndRestoreLoadedRunThroughNavigationCoordinator()
Do not add an unrequested autosave or silently replace the load target.`,
W2e: `INPUT: requestedQuitOperation, runIdentity, saveCapabilities
PARENT: W2
model = ConcreteQuitQuestionFromActualSaveOrLossPolicy()
model.primaryLabel = VerbForRequestedOperation()
confirmBinding = ExistingSaveAndQuitOrQuitWithoutSaveCommand()
RenderWithW2(model, confirmBinding)
IF save required AND save fails: RemainAndShowFailure()
ON cancel: RestorePreviousViewThroughW0()
Red destructive exception follows consequences, not the word Quit alone.`,
W3: `INPUT: menuDefinition, supportedDestinations, saveSummaries, highlightState
PARENT: W0; VARIANT: full-screen title menu
model.titlePlacement = screenCenter
model.headerExtras = ProfileActionAtTopRight()
canPreview = ContinueIsAvailable() AND highlightedActionId == continue
model.bodyLayout = canPreview ? continuePreview : centeredMenu
model.preview = canPreview ? PreviewOfExactContinueSlot() : absent
IF mode == wide AND canPreview: PlaceMenuLeftAndPreviewRight()
ELSE: CenterMenu(); PlacePreviewBelowOnlyWhenPresent()
RenderWithW0(model); KeepTitleFixedAtFullScreenCenter()
ON hover/focus/controllerHighlight: UpdateOneSharedHighlightState()
ON layoutChange: PreserveNodeIdentityAndPreventPointerHoverOscillation()
ON activate: NavigateThroughRegisteredDestinationBinding()
Highlighting never loads, deletes, or saves a run.`,
W3a: `INPUT: mainMenuContext where Continue is not actively highlighted
PARENT: W3
model.layout = centeredMenu
model.preview = absent
RenderWithW3(model)
DoNotReserveAnEmptyPreviewColumn()
ON availableContinueHighlighted: ReprojectSameInstanceAsW3b()
Preserve supported menu items, title center, Profile anchor, and build stamp.`,
W3b: `INPUT: mainMenuContext with available Continue highlighted
PARENT: W3
target = ExactSlotUsedByContinueCommand()
model.preview = SavedCharacterWorldAndSummary(target)
model.layout = wide ? menuLeftPreviewRight : centeredMenuPreviewBelow
RenderWithW3(model)
ON highlightMovesAway OR targetUnavailable: ReprojectSameInstanceAsW3a()
ON ContinueActivated: DispatchExistingLoadNavigation(target)
No title movement; no load or storage writes just to show the preview.`,
W4: `INPUT: committedSnapshot, regionDefinition, localInteractionState
PARENT: W0; VARIANT: gameplay/encounter region host
model.header = SharedHUDProjection(snapshot)
model.body = RegisteredSceneAndContextBodies(regionDefinition)
model.actions = ProjectLegalContextActions(snapshot)
model.layout = ValidatedRegionFractionsAndMinimums()
RenderWithW0(model)
ConvertViewportToLocalCoordinatesThroughSharedAdapter()
ON resize/rotation: ReflowSameSceneAndSelection(); never reset simulation
ON intent: DispatchLocalOrServerAuthoritativeBindingAccordingToSession()
ON navigation: DisposeSceneBindingsAndTransientEffects()
Share chrome/effects, not domain rules, between combat/map/dialogue.`,
W4a: `INPUT: committedCombatSnapshot, enginePreviewAPI, localTargetSelection
PARENT: W4
model.scene = BattlefieldIntentAndStatusProjection()
model.context = HandAndTargetingProjection()
model.footerPlacement = packedCombat
model.actions = [ActionsRemaining, DrawPile, EndTurn, DiscardExhaust, Potions]
model.footerSizes = large(ActionsRemaining, EndTurn, Potions), small(pileButtons)
ComposeW4Regions(
    WGS2.SharedHUD(model.hud),
    WGC1.Battlefield(model.battlefield),
    WGC5.Hand(model.hand),
    WGC6.CombatFooter(model.footer)
)
// Standalone previews and W4a call the same HUD/footer renderers.
CenterGroupWithMinimalSharedGapsInEveryMode()
EmptyResourceOrPileIndicatorsFade(); EndTurnNeverUsesEmptyFade()
EndTurnGreen = canEndTurn AND (actionsRemaining == 0 OR highlightedEndTurn)
ON DrawPile: OpenReadOnlyDrawViewer()
ON DiscardExhaust: OpenW1h()
ON EndTurn: DispatchExistingEngineOrServerCommandIfLegal()
ON card/target/potion intent: UseExistingValidatedCombatBindings()
The discussed 10/40/35/15 region split is a starting allocation to verify.
Preserve RNG calls, simulation timing, combat saves, and server authority.`,
W4b: `INPUT: mapSnapshot, revealRules, selectedNodeId, viewport
PARENT: W4
model.regionFractions = [topHUD:0.10, map:0.60, details:0.20, footer:0.10]
model.mapInlineFraction = 0.95
model.header = HUDIncludingRegionSelector()
model.scene = RevealedMapAndReachabilityProjection()
model.context = KnownSelectedNodeFactsAndBlockers()
model.actions = [Recenter, EnterSelectedDestination]
RenderWithW4(model); KeepPaddingInsideHeightBudget()
ON selectNode: UpdateLocalPreviewWithoutEnteringOrRevealingHiddenFacts()
ON Recenter: DispatchViewOnlyMapCameraIntent()
ON Enter: RevalidateReachabilityAndDispatchExistingNodeEntryCommand()
ON constrainedTextOrHeight: HonorInputMinimumsAndControlledDetailsOverflow()
Never add combat footer controls or a fifth region-selector band.`,
W4c: `INPUT: dialogueGraph, questSnapshot, playerIdentity, npcIdentity, locale
PARENT: W4; BODY: portrait dialogue replacing hand/cards
model.scene = PlayerPortraitLeftAndNPCPortraitRight()
model.context = CurrentSpeakerShortCaptionAndRequiredChoices()
model.actions = [Back, SkipSpeech, Continue]
RenderWithW4(model); KeepFooterInlineAndPortraitSidesStable()

FUNCTION ShowBeat(id, reviewing = false):
    StopClipAndTimers(); generation = generation + 1
    activeGeneration = generation
    ProjectAndRenderBeat(id)
    IF reviewing OR noPlayableVoice: AwaitManualContinue(); RETURN
    Speech.Play(clip, onEnded = FUNCTION:
        IF disposed OR activeGeneration != generation: RETURN
        IF autoAdvance AND nextBeatIsLinearAndNonCommitting:
            ScheduleConfiguredReadablePauseThenAdvance(activeGeneration)
        ELSE AwaitChoiceOrContinue())

ON Continue: CancelPendingAdvance(); AdvanceOneBeatOrConfirmSelectedChoice()
ON SkipSpeech: CancelPendingAdvance(); MoveToNextRequiredBoundaryWithoutEffects()
ON Back: ReviewPreviousVisitedBeatWithoutUndoingOrReplayingDomainCommands()
ON chooseResponse: RevalidateQuestState(); DispatchConfirmedChoiceOnce()
ON voicePause: PauseClipAndAutoAdvanceTimer()
ON audioFailure/mute: KeepCaptionsAndManualControlsAvailable()
ON dispose: InvalidateGeneration(); StopClipTimersAndListeners()
Audio completion, Back, and Skip never grant rewards or choose responses.`
};

pseudocode.W1w = `INPUT: entityRef, context, returnFocusTarget
PARENT: W1
ResolveCurrentEntityOrShowUnavailableState()
MountInheritedW1Shell(title, exit, inlineFooter)
ReplaceCategoryRailWithReadOnlyCardPreview()
UseTwoColumns(leftCard=wideOrCompact34PercentOrPortrait32Percent, gap=2vw, rightDetails=remaining)
ContainLeftPreview(maxWidth=14rem); reserve header and footer
AlignFactLabelsAndValuesToSharedLeftAlignedColumns()
IfNoRelevantDomainAction: RenderFullWidthBackButton()
RenderWC0PreviewWithInheritedRatiosAndNoNestedInfoButton()
IF combatant: RenderOnlySpriteNameAndHPInLeftPreview()
IF combatant: ProjectAvailableResourcesIntentDefenseStanceStatusesBuildupIntoRightPane()
UseRegisteredDetailProvidersFromTheSameCombatantSnapshot()
SetModalTitle(combatant.displayName)
RenderTopSummary(HP, intent, defense)
FilterCurrentOptionalFactsByDomainActivity(); preserve known history/lore
RenderOrderedSections(currentState, previousActions, knownAbilities, knownTraits, lore)
ApplyPlayerKnowledgeFilterBeforeRendering(); distinguish unknown from none
AlignAllFactLabelsAndValuesToSharedColumns(); body scrolls independently
ProjectDetailsFromRegisteredTagComponentsAndDomainQueries()
KeepCardLeftAndDetailsRightInWideCompactPortrait()
ScrollOnlyDetailsWhenRequired; preserve readable minimums
ON primary: ExistingDomainCommandRevalidatesEntityAndContext()
ON close/back/escape: DisposeThenRestoreOriginSelectionAndFocus()
ON entityRemoved: DisableDomainActionsAndShowUnavailableReason()
No timer callbacks or preview activation may open another inspector.`;
