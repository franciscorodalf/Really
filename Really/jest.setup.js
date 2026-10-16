// react-native-worklets@0.10.x ships a dedicated Jest mock for its native
// bindings. Without it, importing react-native-reanimated (which now depends
// on react-native-worklets) throws:
//   "Cannot read properties of undefined (reading 'loadUnpackers')"
// because there is no native module available in the Jest/Node environment.
//
// This is the officially documented "Mock Implementation" setup from the
// react-native-worklets testing guide:
// https://docs.swmansion.com/react-native-worklets/docs/guides/testing/
jest.mock('react-native-worklets', () =>
    require('react-native-worklets/lib/module/mock')
);

// AsyncStorage has no native module under Jest. Use the official in-memory
// mock and wipe it after every test so suites never see each other's data.
jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// NetInfo has no native module under Jest. Use the official mock; tests drive
// it by overriding NetInfo.addEventListener.
jest.mock('@react-native-community/netinfo', () =>
    require('@react-native-community/netinfo/jest/netinfo-mock.js')
);

afterEach(async () => {
    const storage = require('@react-native-async-storage/async-storage');
    const asyncStorage = storage.default ?? storage;
    if (asyncStorage && typeof asyncStorage.clear === 'function') {
        await asyncStorage.clear();
    }
});
