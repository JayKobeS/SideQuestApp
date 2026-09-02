# CLAUDE.md

## Project Overview

This repository contains **SideQuest**, a social mobile application inspired by BeReal, but focused on sharing one daily moment, story or challenge with friends.

The repository is a **monorepo** with two main applications:

* `mobile/` → React Native application built with Expo and TypeScript.
* `backend/` → FastAPI backend written in Python 3.13.

Claude Code is responsible for maintaining both applications consistently.

---

# Technology Stack

## Mobile

* React Native
* Expo SDK (latest stable)
* TypeScript
* Expo Router
* NativeWind
* Zustand
* TanStack Query
* React Hook Form

## Backend

* FastAPI
* SQLAlchemy (async)
* PostgreSQL
* Redis
* Alembic
* JWT Authentication
* Pydantic v2

## Infrastructure

* Docker Compose for local development.
* PostgreSQL and Redis run inside Docker.
* Images are stored outside PostgreSQL (Supabase Storage or Firebase Storage in the future).

---

# Architecture Rules

Keep a clean separation of responsibilities.

## mobile/

Contains only UI, navigation, local state and API communication.

Never implement business logic that belongs on the backend.

## backend/

Contains authentication, authorization, business logic, database models and API endpoints.

Never duplicate backend validation inside the frontend.

---

# Code Style

## General

* Write clean, modular and reusable code.
* Avoid files longer than ~300 lines when possible.
* Split logic into hooks, services and components.
* Use meaningful names.
* Do not leave commented-out code.
* Do not introduce unnecessary abstractions.

## TypeScript

* Always use TypeScript strict mode.
* Avoid `any`.
* Prefer interfaces and inferred types.

## Python

* Use async FastAPI endpoints whenever possible.
* Use SQLAlchemy ORM instead of raw SQL unless requested.
* Use dependency injection for database sessions.

---

# Folder Conventions

## Mobile

app/
screens and routes

components/
reusable UI components

hooks/
custom React hooks

services/
API clients

store/
Zustand stores

types/
shared TypeScript types

utils/
helper functions

## Backend

api/
FastAPI routers

models/
SQLAlchemy models

schemas/
Pydantic schemas

services/
business logic

repositories/
database access

core/
configuration and security

utils/
helper functions

tests/
unit and integration tests

---

# API Rules

* REST API only.
* JSON responses.
* Use HTTP status codes correctly.
* Validate all request bodies using Pydantic.
* Authentication uses JWT Bearer tokens.

Never hardcode URLs.

Use environment variables.

---

# Database Rules

PostgreSQL is the source of truth.

Redis is cache only.

Never store image binaries inside PostgreSQL.

Use Alembic for every schema change.

---

# UI Guidelines

Style should be modern and minimal.

Use:

* rounded corners
* subtle shadows
* smooth animations
* dark mode support
* spacing based on 4/8pt grid

Avoid heavy gradients unless requested.

---

# State Management

Use:

* Zustand for global state.
* TanStack Query for server state.
* React Hook Form for forms.

Avoid Context API for application state unless necessary.

---

# Before Writing Code

Claude should:

1. Inspect existing files.
2. Reuse existing components when possible.
3. Keep naming consistent.
4. Avoid creating duplicate utilities.

---

# After Every Change

Claude should:

1. Update imports.
2. Keep the project compiling.
3. Avoid breaking existing APIs.
4. Explain briefly what changed.

---

# Things Claude Should Never Do

* Never rewrite unrelated files.
* Never rename folders without explicit request.
* Never change environment variable names unless necessary.
* Never install additional libraries without explaining why.

---

# Preferred Workflow

When implementing a feature:

1. Explain the plan briefly.
2. Implement backend if needed.
3. Implement frontend.
4. Connect API.
5. Explain how to test it.

Keep changes small and incremental.

---

# Project Goal

Build a production-quality social mobile application that is scalable, readable and easy to maintain.
