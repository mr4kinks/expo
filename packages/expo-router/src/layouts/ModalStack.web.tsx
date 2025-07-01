import {
  createNavigatorFactory,
  ParamListBase,
  StackNavigationState,
  StackRouter,
  useNavigationBuilder,
  useTheme,
} from '@react-navigation/native';
import { NativeStackView } from '@react-navigation/native-stack';
import React from 'react';
import { Drawer } from 'vaul';

import { ExtendedStackNavigationOptions } from './StackClient';
import { withLayoutContext } from './withLayoutContext';
import modalStyles from '../../assets/modal.module.css';

type Props = {
  initialRouteName?: string;
  screenOptions?: ExtendedStackNavigationOptions;
  children: React.ReactNode;
};

type CSSWithVars = React.CSSProperties & {
  [key: `--${string}`]: string | number;
};

// Helper to determine if a given screen should be treated as a modal-type presentation
function isModalPresentation(
  options?: Partial<Pick<ExtendedStackNavigationOptions, 'presentation'>> | null
) {
  const presentation = options?.presentation;
  return (
    presentation === 'modal' ||
    presentation === 'formSheet' ||
    presentation === 'fullScreenModal' ||
    presentation === 'containedModal'
  );
}

function ModalStackNavigator({ initialRouteName, children, screenOptions }: Props) {
  const { state, navigation, descriptors, NavigationContent, describe } = useNavigationBuilder(
    StackRouter,
    {
      children,
      screenOptions,
      initialRouteName,
    }
  );

  return (
    <NavigationContent>
      <ModalStackView
        state={state}
        navigation={navigation}
        descriptors={descriptors}
        describe={describe}
      />
    </NavigationContent>
  );
}

function ModalStackView({
  state,
  navigation,
  descriptors,
  describe,
}: {
  state: StackNavigationState<ParamListBase>;
  navigation: any;
  descriptors: Record<
    string,
    {
      navigation: any;
      route: any;
      options: ExtendedStackNavigationOptions;
      render: () => React.ReactNode;
    }
  >;
  describe: any;
}) {
  const isWeb = process.env.EXPO_OS === 'web';
  const { colors } = useTheme();

  const nonModalRoutes = state.routes.filter((route) => {
    const isModalType = isModalPresentation(descriptors[route.key].options);
    return !(isWeb && isModalType);
  });

  let nonModalIndex = nonModalRoutes.findIndex((r) => r.key === state.routes[state.index]?.key);
  if (nonModalIndex < 0) nonModalIndex = nonModalRoutes.length - 1;

  const newStackState = { ...state, routes: nonModalRoutes, index: nonModalIndex };

  return (
    <div style={{ flex: 1, display: 'flex' }}>
      <NativeStackView
        state={newStackState}
        navigation={navigation}
        descriptors={descriptors as any}
        describe={describe}
      />
      {isWeb &&
        state.routes.map((route, i) => {
          const isModalType = isModalPresentation(descriptors[route.key].options);
          const isActive = i === state.index && isModalType;
          if (!isActive) return null;

          return (
            <RouteDrawer
              key={route.key}
              routeKey={route.key}
              options={descriptors[route.key].options as ExtendedStackNavigationOptions}
              renderScreen={descriptors[route.key].render}
              onDismiss={() => navigation.goBack()}
              themeColors={colors}
            />
          );
        })}
    </div>
  );
}

const createModalStack = createNavigatorFactory(ModalStackNavigator);
const RouterModal = withLayoutContext(createModalStack().Navigator);

export { RouterModal };

// Internal helper component

function RouteDrawer({
  routeKey,
  options,
  renderScreen,
  onDismiss,
  themeColors,
}: {
  routeKey: string;
  options: ExtendedStackNavigationOptions;
  renderScreen: () => React.ReactNode;
  onDismiss: () => void;
  themeColors: { card: string; background: string };
}) {
  const [open, setOpen] = React.useState(true);
  // Determine sheet vs. modal with an SSR-safe hook. The first render (during
  // hydration) always assumes mobile/sheet to match the server markup; an
  // effect then updates the state after mount if the viewport is desktop.
  const isDesktop = useIsDesktop();
  const isSheet = !isDesktop;

  // Resolve snap points logic.
  const allowed = options.sheetAllowedDetents;

  const isArrayDetents = Array.isArray(allowed);
  const useCustomSnapPoints = isArrayDetents && !(allowed.length === 1 && allowed[0] === 1);

  let snapPoints: (number | string)[] | undefined = useCustomSnapPoints
    ? (allowed as (number | string)[])
    : undefined;

  if (!isSheet) {
    snapPoints = [1];
  }

  const [snap, setSnap] = React.useState<number | string | null>(
    useCustomSnapPoints && isArrayDetents ? allowed[0] : 1
  );

  // Update the snap value when custom snap points change.
  React.useEffect(() => {
    if (isSheet) {
      const next = useCustomSnapPoints && isArrayDetents ? allowed[0] : 1;
      setSnap(next);
    } else {
      // Desktop modal always fixed snap at 1
      setSnap(1);
    }
  }, [isSheet, useCustomSnapPoints, isArrayDetents, allowed]);

  // Map react-native-screens ios sheet undimmed logic to Vaul's fadeFromIndex
  const fadeFromIndex = isSheet
    ? options.sheetLargestUndimmedDetentIndex === 'last'
      ? (snapPoints?.length ?? 0)
      : typeof options.sheetLargestUndimmedDetentIndex === 'number'
        ? options.sheetLargestUndimmedDetentIndex + 1
        : 0
    : 0;

  // --- Styling -----------------------------------------------------------

  // Using CSS variables so defaults live in CSS and can be overridden via props.
  const modalStyleVars: CSSWithVars = {
    backgroundColor: themeColors.background,
  };

  if (!isSheet) {
    if (options.modalWidth) {
      modalStyleVars['--expo-router-modal-width'] =
        typeof options.modalWidth === 'number' ? `${options.modalWidth}px` : options.modalWidth;

      modalStyleVars['--expo-router-modal-max-width'] =
        typeof options.modalWidth === 'number' ? `${options.modalWidth}px` : options.modalWidth;

      // Also set explicit width so browsers that ignore CSS vars in `width` prop still work.
      modalStyleVars.width =
        typeof options.modalWidth === 'number' ? `${options.modalWidth}px` : options.modalWidth;
    }

    // Min width override
    if (options.modalMinWidth) {
      const mw =
        typeof options.modalMinWidth === 'number'
          ? `${options.modalMinWidth}px`
          : options.modalMinWidth;
      modalStyleVars['--expo-router-modal-min-width'] = mw;
      modalStyleVars.minWidth = mw;
    }

    if (options.modalHeight) {
      const h =
        typeof options.modalHeight === 'number' ? `${options.modalHeight}px` : options.modalHeight;
      modalStyleVars['--expo-router-modal-height'] = h;
      modalStyleVars.maxHeight = h;
      modalStyleVars.height = h;
      modalStyleVars.minHeight = h;
    }

    // Separate min-height override (takes precedence over modalHeight)
    if (options.modalMinHeight) {
      const mh =
        typeof options.modalMinHeight === 'number'
          ? `${options.modalMinHeight}px`
          : options.modalMinHeight;
      modalStyleVars['--expo-router-modal-min-height'] = mh;
      modalStyleVars.minHeight = mh;
    }
  }

  const fitToContents = isSheet && options.sheetAllowedDetents === 'fitToContents';

  if (fitToContents) {
    modalStyleVars.height = 'auto';
    modalStyleVars.minHeight = 'auto';
    // Allow sheet to grow with content but never exceed viewport height
    modalStyleVars.maxHeight = 'calc(100vh)';
  }

  // Apply corner radius (default 10px)
  const radiusValue = options.sheetCornerRadius ?? 10;
  const radiusCss = typeof radiusValue === 'number' ? `${radiusValue}px` : radiusValue;

  if (options.modalBorder) {
    modalStyleVars['--expo-router-modal-border'] = options.modalBorder;
  }

  if (isSheet) {
    // Only top corners for mobile sheet
    modalStyleVars.borderTopLeftRadius = radiusCss;
    modalStyleVars.borderTopRightRadius = radiusCss;

    // Only apply CSS var override if a custom corner radius was provided
    if (options.sheetCornerRadius) {
      modalStyleVars['--expo-router-modal-radius'] = radiusCss;
    }
  } else {
    // All corners for desktop modal
    if (options.sheetCornerRadius) {
      modalStyleVars.borderRadius = radiusCss;
      modalStyleVars['--expo-router-modal-radius'] = radiusCss;
    }
  }
  // --- End Styling -----------------------------------------------------------

  const handleOpenChange = (open: boolean) => {
    if (!open) onDismiss();
  };

  // Props that only make sense for sheets
  const sheetProps = isSheet
    ? {
        snapPoints: snapPoints as (number | string)[],
        activeSnapPoint: snap,
        setActiveSnapPoint: setSnap,
        fadeFromIndex,
      }
    : {};

  return (
    <Drawer.Root
      key={`${routeKey}-${isSheet ? 'sheet' : 'modal'}`}
      open={open}
      dismissible={options.gestureEnabled ?? true}
      onAnimationEnd={handleOpenChange}
      onOpenChange={setOpen}
      {...sheetProps}>
      <Drawer.Portal>
        <Drawer.Overlay
          className={modalStyles.overlay}
          style={
            options.modalOverlayBackground
              ? ({
                  '--expo-router-modal-overlay-bg': options.modalOverlayBackground,
                } as React.CSSProperties)
              : undefined
          }
        />
        <Drawer.Content
          aria-describedby="modal-description"
          className={modalStyles.drawerContent}
          style={{
            pointerEvents: 'none',
            ...(fitToContents ? { height: 'auto' } : null),
          }}>
          <div
            className={modalStyles.modal}
            data-presentation={isSheet ? 'formSheet' : 'modal'}
            style={modalStyleVars}>
            {/* Figure out how to add title and description to the modal for screen readers */}
            <Drawer.Title about="" aria-describedby="" className={modalStyles.srOnly} />
            <Drawer.Description about="" className={modalStyles.srOnly} />
            {/* Render the screen content */}
            <div className={modalStyles.modalBody}>{renderScreen()}</div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/**
 * SSR-safe viewport detection: initial render always returns `false` so that
 * server and client markup match. The actual media query evaluation happens
 * after mount.
 */
function useIsDesktop(breakpoint: number = 768) {
  const isWeb = process.env.EXPO_OS === 'web';

  // Ensure server-side and initial client render agree (mobile first).
  const [isDesktop, setIsDesktop] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return;

    const mql = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches);

    // Update immediately after mount
    setIsDesktop(mql.matches);

    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [breakpoint, isWeb]);

  return isDesktop;
}
