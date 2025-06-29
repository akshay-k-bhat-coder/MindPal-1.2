import { useAuth } from './useAuth';
import { supabase } from '../lib/supabase';

export function useEncryption() {
  const { user, handleSupabaseError } = useAuth();

  const encryptData = async (data: string): Promise<string> => {
    // Simple encryption using Web Crypto API
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Generate a key from user ID (in production, use a proper key derivation)
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(user?.id || 'default-key'),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('mindpal-salt'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  };

  const decryptData = async (encryptedData: string): Promise<string> => {
    try {
      const combined = new Uint8Array(
        atob(encryptedData)
          .split('')
          .map(char => char.charCodeAt(0))
      );
      
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const encoder = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(user?.id || 'default-key'),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      
      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: encoder.encode('mindpal-salt'),
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '';
    }
  };

  const storeEncryptedData = async (dataType: string, data: string) => {
    if (!user) return;

    try {
      const encryptedContent = await encryptData(data);
      
      const { error } = await supabase
        .from('encrypted_data')
        .insert([{
          user_id: user.id,
          data_type: dataType,
          encrypted_content: encryptedContent,
        }]);

      if (error) {
        const isJWTError = await handleSupabaseError(error);
        if (!isJWTError) throw error;
        return;
      }
    } catch (error) {
      console.error('Error storing encrypted data:', error);
      throw error;
    }
  };

  const retrieveEncryptedData = async (dataType: string): Promise<string[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('encrypted_data')
        .select('encrypted_content')
        .eq('user_id', user.id)
        .eq('data_type', dataType);

      if (error) {
        const isJWTError = await handleSupabaseError(error);
        if (!isJWTError) return [];
        throw error;
      }

      const decryptedData = await Promise.all(
        (data || []).map(item => decryptData(item.encrypted_content))
      );

      return decryptedData.filter(item => item !== '');
    } catch (error) {
      console.error('Error retrieving encrypted data:', error);
      return [];
    }
  };

  return {
    encryptData,
    decryptData,
    storeEncryptedData,
    retrieveEncryptedData,
  };
}