/*
  # Add phone field to profiles table

  1. Changes
    - Add phone field to profiles table for storing user phone numbers
    - Update RLS policies to include phone field access

  2. Security
    - Maintain existing RLS policies
    - Phone field is optional and nullable
*/

-- Add phone field to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
END $$;