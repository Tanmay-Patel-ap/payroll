#pragma once

#include <vector>
#include <optional>
#include "models/Role.hpp"

class IRoleRepository {
public:
    virtual ~IRoleRepository() = default;

    virtual std::vector<Role> getAll() = 0;
    virtual std::optional<Role> getById(const std::string& id) = 0;
    virtual std::optional<Role> getByName(const std::string& name) = 0;
    virtual bool add(const Role& role) = 0;
    virtual bool update(const Role& role) = 0;
    virtual bool remove(const std::string& id) = 0;
};

